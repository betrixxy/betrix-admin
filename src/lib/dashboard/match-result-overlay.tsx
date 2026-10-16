import { ImageResponse } from "next/og";
import sharp from "sharp";
import { loadMatchDayFonts } from "@/lib/dashboard/match-day-assets";
import type { MatchDayFrame } from "@/lib/dashboard/match-day-formats";
import { matchResultGeometry } from "@/skills/render-engine/templates/match-result/geometry";
import { HeroScoreTemplate } from "@/skills/render-engine/templates/match-result/hero-score";
import type { MatchResultCard } from "@/types/match-result";

/**
 * Maç Sonucu gradyan + tipografi + marka katmanını şeffaf PNG olarak çizer (Satori). AI
 * görseline metin yazdırılmaz; bu katman oyuncu kompozitinin üstüne basılır (CLAUDE.md 3.4).
 * Şu an: kahraman-skor. dergi-kapagi ve cerceve aynı geometri/ortak parçalarla eklenecek.
 */
export async function renderMatchResultOverlay(card: MatchResultCard, frame: MatchDayFrame): Promise<Buffer> {
  const fonts = await loadMatchDayFonts();
  const response = new ImageResponse(<HeroScoreTemplate card={card} g={matchResultGeometry(frame)} />, {
    width: frame.width,
    height: frame.height,
    fonts,
  });
  return sharp(Buffer.from(await response.arrayBuffer())).ensureAlpha().png().toBuffer();
}
