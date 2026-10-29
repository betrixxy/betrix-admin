import { renderSatori } from "@/skills/render-engine/satori-text";
import sharp from "sharp";
import { bandSafeArea, layoutGate } from "@/lib/dashboard/layout-check";
import type { BlockFilter } from "@/skills/render-engine/templates/checkmatch-set/blocks";
import { LINEUP_BLOCKS } from "@/skills/render-engine/templates/lineup/lineup-chrome";
import type { Result } from "@/types/result";
import { loadStudioFonts } from "@/lib/dashboard/studio-fonts";
import { lineupPalette } from "@/lib/dashboard/lineup-palette";
import { logoSwatches } from "@/lib/dashboard/logo-swatches";
import { loadBrandLogo, resolveImage } from "@/lib/dashboard/match-day-assets";
import { parseStoredFileUrl, readStoredFile } from "@/lib/dashboard/storage";
import { LineupCard, lineupGeometry, type LineupHeroImage } from "@/skills/render-engine/templates/lineup/lineup-card";
import { LINEUP_HERO_PATTERN, type LineupCardInput, type LineupTemplateStyle } from "@/types/lineup";
import { SOCIAL_FORMATS, type SocialFormatId } from "@/types/studio-formats";

/** Takım logoları yalnızca API-Football medya sunucusundan gömülür — formdan gelen başka adres çizilmez (SSRF). */
const ALLOWED_IMAGE_ORIGIN = "https://media.api-sports.io/";
const LOGO_SIDE = 272;

async function embedLogo(url: string): Promise<string> {
  if (!url.startsWith(ALLOWED_IMAGE_ORIGIN)) return "";
  // Geçici ağ hatasına karşı bir kez yeniden denenir; olmazsa kart logosuz çizilir.
  return (await resolveImage(url, LOGO_SIDE)) ?? (await resolveImage(url, LOGO_SIDE)) ?? "";
}

/**
 * Kapak: yalnızca kesim motorunun yazdığı şeffaf PNG. Boş (şeffaf) kenarlar atılır ki oyuncu
 * çerçeveye otursun; sonra formatın kapak alanına sığacak şekilde küçültülür. Okunamazsa kart kapaksız çizilir.
 */
async function embedHero(url: string, format: SocialFormatId): Promise<LineupHeroImage | null> {
  const { maxWidth, maxHeight } = lineupGeometry(format).hero;
  if (!LINEUP_HERO_PATTERN.test(url)) return null;
  const stored = parseStoredFileUrl(url);
  const bytes = stored ? await readStoredFile(stored.bucket, stored.fileName) : null;
  if (!bytes) return null;
  try {
    const { data, info } = await sharp(bytes)
      .trim({ threshold: 1 })
      .resize({ width: maxWidth, height: maxHeight, fit: "inside", withoutEnlargement: false })
      .png()
      .toBuffer({ resolveWithObject: true });
    return { src: `data:image/png;base64,${data.toString("base64")}`, width: info.width, height: info.height };
  } catch (cause) {
    console.error("[lineup] kapak işlenemedi:", cause);
    return null;
  }
}

/**
 * Tek takımlık Muhtemel 11 kartını PNG olarak çizer (Fal.ai yok — kapak kesimi önceden üretilmiş olmalı).
 * Renkler takım logosundan okunur (önbellekli); kapak okunamazsa kart taktik tahtasına düşer —
 * kapaksız liste kartı çizilmez.
 */
export interface RenderedLineupCard {
  png: Buffer;
  /** Gerçekte çizilen şablon — kapak okunamazsa liste istense de "pitch". */
  templateStyle: LineupTemplateStyle;
}

/**
 * Kartı çizer (Fal.ai yok); `only` verilirse yerleşim kapısı için yalnızca o blok. Önce yerleşim kapısı: logo
 * dahil bütün bloklar birbiriyle ve güvenli alanla çakışmamalı; çakışmada kart üretilmez, sebep döner.
 */
export async function renderLineupCard(input: LineupCardInput): Promise<Result<RenderedLineupCard>> {
  const prepared = await prepareLineupCard(input);
  const frame = SOCIAL_FORMATS[input.format];
  const gate = await layoutGate("Muhtemel 11", frame, (only) => drawLineupCard(prepared, only), LINEUP_BLOCKS, bandSafeArea(frame));
  if (!gate.ok) return gate;
  return { ok: true, data: { png: await drawLineupCard(prepared), templateStyle: prepared.card.templateStyle } };
}

type PreparedLineupCard = Awaited<ReturnType<typeof prepareLineupCard>>;

async function drawLineupCard({ input, fonts, brandLogo, logoUrl, opponentLogoUrl, card, palette }: PreparedLineupCard, only?: BlockFilter): Promise<Buffer> {
  const response = renderSatori(
    <LineupCard {...input} {...card} team={{ ...input.team, logoUrl }} opponentLogoUrl={opponentLogoUrl} brandLogo={brandLogo} palette={palette} only={only} />,
    { width: SOCIAL_FORMATS[input.format].width, height: SOCIAL_FORMATS[input.format].height, fonts },
  );
  return Buffer.from(await response.arrayBuffer());
}

/** Görseller, fontlar ve palet bir kez hazırlanır — yerleşim kapısının blok çizimleri yeniden indirmez. */
async function prepareLineupCard(input: LineupCardInput) {
  const [fonts, brandLogo, logoUrl, opponentLogoUrl, hero] = await Promise.all([
    loadStudioFonts(),
    loadBrandLogo(),
    embedLogo(input.team.logoUrl),
    embedLogo(input.opponentLogoUrl),
    // Kapak yalnızca "Kahraman Liste" şablonunda çizilir; taktik tahtasında hiç okunmaz.
    input.templateStyle === "hero_list" ? embedHero(input.team.heroImageUrl, input.format) : null,
  ]);
  const swatches = logoUrl ? await logoSwatches(input.team.logoUrl, logoUrl) : null;
  const card = hero ? { templateStyle: "hero_list" as const, hero } : { templateStyle: "pitch" as const, hero: null };
  return { input, fonts, brandLogo, logoUrl, opponentLogoUrl, card, palette: lineupPalette(swatches, input.team.colorHex) };
}
