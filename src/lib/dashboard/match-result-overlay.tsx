import { ImageResponse } from "next/og";
import type { ReactElement } from "react";
import sharp from "sharp";
import { loadMatchDayFonts } from "@/lib/dashboard/match-day-assets";
import type { MatchDayFrame } from "@/lib/dashboard/match-day-formats";
import { FullFrameTemplate } from "@/skills/render-engine/templates/match-result/full-frame";
import { matchResultGeometry } from "@/skills/render-engine/templates/match-result/geometry";
import { HeroScoreTemplate } from "@/skills/render-engine/templates/match-result/hero-score";
import type { MatchResultCard } from "@/types/match-result";

/**
 * Maç Sonucu gradyan + tipografi + marka katmanını şeffaf PNG olarak çizer (Satori). AI
 * görseline metin yazdırılmaz; bu katman sanat katmanının üstüne basılır (CLAUDE.md 3.4).
 * `photo` verilirse tam kadraj maç fotoğrafı şablonu (A · Tam Kadraj) ölçülen gradyan gücüyle
 * çizilir; verilmezse kesim modunun kahraman-skor şablonu.
 */
export async function renderMatchResultOverlay(card: MatchResultCard, frame: MatchDayFrame, photo?: { shadeStrength: number }): Promise<Buffer> {
  const fonts = await loadMatchDayFonts();
  const g = matchResultGeometry(frame);
  const element: ReactElement = photo ? <FullFrameTemplate card={card} g={g} shadeStrength={photo.shadeStrength} /> : <HeroScoreTemplate card={card} g={g} />;
  const response = new ImageResponse(element, { width: frame.width, height: frame.height, fonts });
  return sharp(Buffer.from(await response.arrayBuffer())).ensureAlpha().png().toBuffer();
}
