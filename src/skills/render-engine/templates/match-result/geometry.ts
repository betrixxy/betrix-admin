import type { MatchDayFrame } from "@/lib/dashboard/match-day-formats";
import type { PlayerSlot } from "../match-day/geometry";

/**
 * Maç Sonucu geometrisi — TEK KAYNAK: Satori tipografisi (metin kutusu, gradyan) ve sharp
 * kompozisyonu (MVP yerleşimi) aynı sayıları okur. Kurallar: 64px güvenli kenar boşluğu,
 * tüm yazılar koyu gradyan bölgesinde, CheckMatch logosu her şablonda sağ altta.
 * Temel kompozisyon 1080×1350; 1:1 `k` ile küçülür, 9:16 platform bantlarını boş bırakır.
 */

export const SAFE_MARGIN = 64;

export interface ResultGeometry {
  frame: MatchDayFrame;
  k: number;
  /** İçerik kutusu: güvenli alan + 64px kenar boşluğu düşülmüş. */
  top: number;
  bottom: number;
  left: number;
  right: number;
  /** Koyu gradyanın başladığı (şeffaf) ve tam koyulaştığı nokta — dikeyde y, yatayda x. */
  shadeStart: number;
  shadeSolid: number;
  /** Ana oyuncu (MVP) kesimi; beraberlik varyantında iki oyuncu `pair`'den okunur. */
  hero: PlayerSlot;
  pair: [PlayerSlot, PlayerSlot];
}

function vertical(frame: MatchDayFrame): ResultGeometry {
  const k = Math.min(1, frame.height / 1350);
  const top = frame.safeTop + SAFE_MARGIN;
  const bottom = frame.height - frame.safeBottom - SAFE_MARGIN;
  // Alt blok (MVP satırı + skor şeridi + golcüler + künye) ≈ 410px → 4:5'te kartın alt %35'i.
  const shadeSolid = bottom - Math.round(410 * k);
  const shadeStart = shadeSolid - Math.round(260 * k);
  const playerTop = top - Math.round(20 * k);
  const playerHeight = shadeSolid + Math.round(140 * k) - playerTop;
  const half = (dir: -1 | 1): PlayerSlot => ({
    centerX: frame.width / 2 + dir * Math.round(230 * k),
    top: playerTop + Math.round(30 * k),
    maxWidth: Math.round(620 * k),
    maxHeight: playerHeight - Math.round(30 * k),
  });
  return {
    frame,
    k,
    top,
    bottom,
    left: SAFE_MARGIN,
    right: frame.width - SAFE_MARGIN,
    shadeStart,
    shadeSolid,
    hero: { centerX: frame.width / 2, top: playerTop, maxWidth: frame.width - 80, maxHeight: playerHeight },
    pair: [half(-1), half(1)],
  };
}

/** 16:9 — oyuncu solda, yazı bloğu sağda; gradyan soldan sağa koyulaşır. */
function landscape(frame: MatchDayFrame): ResultGeometry {
  const slot = (centerX: number, maxWidth = 560): PlayerSlot => ({ centerX, top: 24, maxWidth, maxHeight: frame.height + 80 });
  return {
    frame,
    k: 1,
    top: SAFE_MARGIN,
    bottom: frame.height - SAFE_MARGIN,
    left: 560,
    right: frame.width - SAFE_MARGIN,
    shadeStart: 380,
    shadeSolid: 600,
    hero: slot(300),
    // Split: iki oyuncu sol yarıda kalır, sağdaki yazı sütununa (x ≥ 560) taşmaz.
    pair: [slot(150, 420), slot(380, 420)],
  };
}

export function matchResultGeometry(frame: MatchDayFrame): ResultGeometry {
  return frame.orientation === "landscape" ? landscape(frame) : vertical(frame);
}
