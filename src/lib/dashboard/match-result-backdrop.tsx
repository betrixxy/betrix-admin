import { ImageResponse } from "next/og";
import sharp from "sharp";
import { loadMatchDayFonts } from "@/lib/dashboard/match-day-assets";
import type { MatchDayFrame } from "@/lib/dashboard/match-day-formats";
import type { MatchOutcome } from "@/types/match-result";
import { DISPLAY } from "@/skills/render-engine/templates/match-day/shared";

/**
 * Maç Sonucu (01) arka plan tipografisi — oyuncunun ARKASINDA, kartın üst yarısını kaplayan dev ve
 * çok soluk yazı: galibiyette skor ("1-0"), beraberlikte "BERABERE". Anton, %7 beyaz dolgu. Şeffaf
 * PNG olarak çizilir ve sharp kompozisyonunda arka plan ile oyuncu kesimi ARASINA basılır
 * (CLAUDE.md 3.4: z-background üstü, z-players altı) — oyuncu her zaman önde durur.
 */

const FILL = "rgba(255,255,255,0.07)";
/** Anton'da karakter başına yaklaşık genişlik (em). */
const EM_PER_CHAR = 0.47;

export function backdropText(outcome: MatchOutcome, homeGoals: number, awayGoals: number): string {
  return outcome === "DRAW" && homeGoals === awayGoals ? "BERABERE" : `${homeGoals}-${awayGoals}`;
}

/** Dikeyde kartın üst ~%55'i; 16:9'da oyuncunun durduğu sol bölge. */
function area(frame: MatchDayFrame): { left: number; top: number; width: number; height: number } {
  return frame.orientation === "landscape"
    ? { left: 0, top: 0, width: 600, height: frame.height }
    : { left: 0, top: frame.safeTop, width: frame.width, height: Math.round((frame.height - frame.safeTop - frame.safeBottom) * 0.55) };
}

export async function renderResultBackdrop(text: string, frame: MatchDayFrame): Promise<Buffer> {
  const box = area(frame);
  const size = Math.round(Math.min((box.width * 0.94) / (text.length * EM_PER_CHAR), box.height * 0.95));
  const fonts = await loadMatchDayFonts();
  const response = new ImageResponse(
    (
      <div tw="relative flex h-full w-full">
        <div tw="absolute flex items-center justify-center" style={{ left: box.left, top: box.top, width: box.width, height: box.height }}>
          <span style={{ fontFamily: DISPLAY, fontSize: size, lineHeight: 1, letterSpacing: Math.round(size * 0.01), color: FILL }}>{text}</span>
        </div>
      </div>
    ),
    { width: frame.width, height: frame.height, fonts },
  );
  return sharp(Buffer.from(await response.arrayBuffer())).ensureAlpha().png().toBuffer();
}
