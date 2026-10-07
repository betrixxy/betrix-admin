import { ImageResponse } from "next/og";
import sharp from "sharp";
import { loadDeepAnalysisFonts } from "@/lib/dashboard/deep-analysis-fonts";
import { loadBrandLogo, resolveImage } from "@/lib/dashboard/match-day-assets";
import { parseStoredFileUrl, readStoredFile } from "@/lib/dashboard/storage";
import { LINEUP_CARD_SIZE, LineupCard, type LineupHeroImage } from "@/skills/render-engine/templates/lineup/lineup-card";
import { LINEUP_HERO_PATTERN, type LineupCardInput } from "@/types/lineup";

/** Takım logoları yalnızca API-Football medya sunucusundan gömülür — formdan gelen başka adres çizilmez (SSRF). */
const ALLOWED_IMAGE_ORIGIN = "https://media.api-sports.io/";
const LOGO_SIDE = 272;
/** Kapak kesiminin kartta kapladığı en büyük alan (sol yarı, alttan taşar). */
const HERO_MAX = { width: 640, height: 1040 } as const;

async function embedLogo(url: string): Promise<string> {
  if (!url.startsWith(ALLOWED_IMAGE_ORIGIN)) return "";
  // Geçici ağ hatasına karşı bir kez yeniden denenir; olmazsa kart logosuz çizilir.
  return (await resolveImage(url, LOGO_SIDE)) ?? (await resolveImage(url, LOGO_SIDE)) ?? "";
}

/**
 * Kapak: yalnızca kesim motorunun yazdığı şeffaf PNG. Boş (şeffaf) kenarlar atılır ki oyuncu
 * çerçeveye otursun; sonra sol yarıya sığacak şekilde küçültülür. Okunamazsa kart kapaksız çizilir.
 */
async function embedHero(url: string): Promise<LineupHeroImage | null> {
  if (!LINEUP_HERO_PATTERN.test(url)) return null;
  const stored = parseStoredFileUrl(url);
  const bytes = stored ? await readStoredFile(stored.bucket, stored.fileName) : null;
  if (!bytes) return null;
  try {
    const { data, info } = await sharp(bytes)
      .trim({ threshold: 1 })
      .resize({ ...HERO_MAX, fit: "inside", withoutEnlargement: false })
      .png()
      .toBuffer({ resolveWithObject: true });
    return { src: `data:image/png;base64,${data.toString("base64")}`, width: info.width, height: info.height };
  } catch (cause) {
    console.error("[lineup] kapak işlenemedi:", cause);
    return null;
  }
}

/** Tek takımlık Muhtemel 11 kartını PNG olarak çizer (Fal.ai yok — kapak kesimi önceden üretilmiş olmalı). */
export async function renderLineupCard(input: LineupCardInput): Promise<Buffer> {
  const [fonts, brandLogo, logoUrl, opponentLogoUrl, hero] = await Promise.all([
    loadDeepAnalysisFonts(),
    loadBrandLogo(),
    embedLogo(input.team.logoUrl),
    embedLogo(input.opponentLogoUrl),
    embedHero(input.team.heroImageUrl),
  ]);
  const response = new ImageResponse(
    <LineupCard {...input} team={{ ...input.team, logoUrl }} opponentLogoUrl={opponentLogoUrl} brandLogo={brandLogo} hero={hero} />,
    { ...LINEUP_CARD_SIZE, fonts },
  );
  return Buffer.from(await response.arrayBuffer());
}
