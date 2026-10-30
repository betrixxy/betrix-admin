import { renderSatori } from "@/skills/render-engine/satori-text";
import sharp from "sharp";
import { bandSafeArea, layoutGate } from "@/lib/dashboard/layout-check";
import { lineupHeroArt, socialFrame } from "@/lib/dashboard/lineup-hero-art";
import type { PhotoUpscaler } from "@/lib/dashboard/match-photo/quality";
import { finalizeSetImage } from "@/lib/dashboard/set-finish";
import type { BlockFilter } from "@/skills/render-engine/templates/checkmatch-set/blocks";
import { LINEUP_BLOCKS } from "@/skills/render-engine/templates/lineup/lineup-chrome";
import type { Result } from "@/types/result";
import { loadStudioFonts } from "@/lib/dashboard/studio-fonts";
import { lineupPalette } from "@/lib/dashboard/lineup-palette";
import { logoSwatches } from "@/lib/dashboard/logo-swatches";
import { loadBrandLogo, resolveImage } from "@/lib/dashboard/match-day-assets";
import { LineupCard, lineupGeometry } from "@/skills/render-engine/templates/lineup/lineup-card";
import type { LineupCardInput, LineupTemplateStyle } from "@/types/lineup";
import { SOCIAL_FORMATS } from "@/types/studio-formats";

/** Takım logoları yalnızca API-Football medya sunucusundan gömülür — formdan gelen başka adres çizilmez (SSRF). */
const ALLOWED_IMAGE_ORIGIN = "https://media.api-sports.io/";
const LOGO_SIDE = 272;

async function embedLogo(url: string): Promise<string> {
  if (!url.startsWith(ALLOWED_IMAGE_ORIGIN)) return "";
  // Geçici ağ hatasına karşı bir kez yeniden denenir; olmazsa kart logosuz çizilir.
  return (await resolveImage(url, LOGO_SIDE)) ?? (await resolveImage(url, LOGO_SIDE)) ?? "";
}

/**
 * Tek takımlık Muhtemel 11 kartını PNG olarak çizer (Fal.ai yok). Renkler takım logosundan okunur (önbellekli).
 * "Kahraman Liste": kapak fotoğrafı (`input.heroPhoto`, arşivden) Vitrin hattıyla sanat katmanına basılır,
 * yazı katmanı üstüne gelir, set ailesinin gren/vinyet bitişi uygulanır. Kapak fotoğrafı yoksa kapak ORTAK YEDEK
 * TASARIMDIR (takım rengi + filigran arma + soluk dev ad, `team-fallback.tsx`) — liste yine çizilir.
 */
export interface RenderedLineupCard {
  png: Buffer;
  /** Gerçekte çizilen şablon (admin'in seçimi; kapaksız liste yedek tasarımla). */
  templateStyle: LineupTemplateStyle;
}

/**
 * Önce yerleşim kapısı (yazı katmanı: logo dahil bütün bloklar birbiriyle ve güvenli alanla çakışmamalı;
 * kapak fotoğrafı zemindir, ölçülmez); çakışmada ya da fotoğraf kalite kapısında kart üretilmez, sebep döner.
 */
export async function renderLineupCard(input: LineupCardInput, options: { upscale?: PhotoUpscaler | undefined } = {}): Promise<Result<RenderedLineupCard>> {
  const prepared = await prepareLineupCard(input);
  const frame = SOCIAL_FORMATS[input.format];
  const gate = await layoutGate("Muhtemel 11", frame, (only) => drawLineupCard(prepared, only), LINEUP_BLOCKS, bandSafeArea(frame));
  if (!gate.ok) return gate;
  const overlay = await drawLineupCard(prepared);
  if (prepared.templateStyle === "pitch") return { ok: true, data: { png: overlay, templateStyle: "pitch" } };

  const fallback = { name: input.team.teamName, hex: prepared.palette.glow, logo: prepared.logoUrl || null };
  const art = await lineupHeroArt({ g: lineupGeometry(input.format), format: input.format, palette: prepared.palette, photo: input.heroPhoto ?? null, fallback, adjust: input.team.heroAdjust, upscale: options.upscale });
  if (!art.ok) return art;
  const layer = await sharp(overlay).ensureAlpha().png().toBuffer();
  // Gren tohumu takım + fotoğraf: aynı kart her çizimde aynı.
  const png = await finalizeSetImage(art.data, layer, socialFrame(input.format), `lineup-${input.team.teamName}-${input.heroPhoto?.hash ?? "yedek"}`);
  return { ok: true, data: { png, templateStyle: "hero_list" } };
}

type PreparedLineupCard = Awaited<ReturnType<typeof prepareLineupCard>>;

async function drawLineupCard({ input, templateStyle, fonts, brandLogo, logoUrl, opponentLogoUrl, palette }: PreparedLineupCard, only?: BlockFilter): Promise<Buffer> {
  // Kapak baytları yazı katmanına gitmez (sanat katmanında); `heroPhoto` şablonda okunmaz.
  const response = renderSatori(
    <LineupCard {...input} templateStyle={templateStyle} team={{ ...input.team, logoUrl }} opponentLogoUrl={opponentLogoUrl} brandLogo={brandLogo} palette={palette} only={only} />,
    { width: SOCIAL_FORMATS[input.format].width, height: SOCIAL_FORMATS[input.format].height, fonts },
  );
  return Buffer.from(await response.arrayBuffer());
}

/** Logolar, fontlar ve palet bir kez hazırlanır — yerleşim kapısının blok çizimleri yeniden indirmez. */
async function prepareLineupCard(input: LineupCardInput) {
  const [fonts, brandLogo, logoUrl, opponentLogoUrl] = await Promise.all([loadStudioFonts(), loadBrandLogo(), embedLogo(input.team.logoUrl), embedLogo(input.opponentLogoUrl)]);
  const swatches = logoUrl ? await logoSwatches(input.team.logoUrl, logoUrl) : null;
  // Admin'in seçimi; "Kahraman Liste"de kapak fotoğrafı yoksa kapak yedek tasarımdır.
  const templateStyle: LineupTemplateStyle = input.templateStyle;
  return { input, templateStyle, fonts, brandLogo, logoUrl, opponentLogoUrl, palette: lineupPalette(swatches, input.team.colorHex) };
}
