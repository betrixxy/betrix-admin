import { ImageResponse } from "next/og";
import { loadDeepAnalysisFonts } from "@/lib/dashboard/deep-analysis-fonts";
import { loadBrandLogo, resolveImage } from "@/lib/dashboard/match-day-assets";
import { LINEUP_CARD_SIZE, LineupCard } from "@/skills/render-engine/templates/lineup/lineup-card";
import type { LineupCardInput } from "@/types/lineup";

/** Takım logosu yalnızca API-Football medya sunucusundan gömülür — formdan gelen başka adres çizilmez (SSRF). */
const ALLOWED_IMAGE_ORIGIN = "https://media.api-sports.io/";
const LOGO_SIDE = 256;

async function embedLogo(url: string): Promise<string> {
  if (!url.startsWith(ALLOWED_IMAGE_ORIGIN)) return "";
  // Geçici ağ hatasına karşı bir kez yeniden denenir; olmazsa kart logosuz çizilir.
  return (await resolveImage(url, LOGO_SIDE)) ?? (await resolveImage(url, LOGO_SIDE)) ?? "";
}

/** Tek takımlık Muhtemel 11 kartını PNG olarak çizer (Fal.ai yok, ücretsiz, oyuncu görseli yok). */
export async function renderLineupCard(input: LineupCardInput): Promise<Buffer> {
  const [fonts, brandLogo, logoUrl] = await Promise.all([loadDeepAnalysisFonts(), loadBrandLogo(), embedLogo(input.team.logoUrl)]);
  const response = new ImageResponse(<LineupCard {...input} team={{ ...input.team, logoUrl }} brandLogo={brandLogo} />, {
    ...LINEUP_CARD_SIZE,
    fonts,
  });
  return Buffer.from(await response.arrayBuffer());
}
