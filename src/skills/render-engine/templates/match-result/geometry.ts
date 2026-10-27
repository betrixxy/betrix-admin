import type { MatchDayFrame } from "@/lib/dashboard/match-day-formats";
import type { MatchResultTemplateId } from "@/types/match-result";
import { LANDSCAPE_GUTTER, landscapeColumnBox, type ColumnSide } from "../checkmatch-set/landscape";

/**
 * Maç Sonucu geometrisi — TEK KAYNAK: Satori tipografisi (metin kutusu, gradyan) ve tam kadraj
 * fotoğrafın akıllı kırpması (`photoSafe`) aynı sayıları okur. Kurallar: 64px güvenli kenar
 * boşluğu, tüm yazılar koyu gradyan bölgesinde, CheckMatch logosu her şablonda sağ altta.
 * Temel kompozisyon 1080×1350; 1:1 `k` ile küçülür, 9:16 platform bantlarını boş bırakır.
 * 16:9'da yazılar set sütunundadır (`checkmatch-set/landscape.tsx`); sütun sağda, özne sağdaysa
 * sola aynalanır (`side`).
 */

export const SAFE_MARGIN = 64;

export interface FrameBox {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface ResultGeometry {
  frame: MatchDayFrame;
  k: number;
  /** İçerik kutusu: güvenli alan + 64px kenar boşluğu düşülmüş. */
  top: number;
  bottom: number;
  left: number;
  right: number;
  /** 16:9 set sütununun tarafı (dikeyde her zaman "right" — anlamsız). */
  side: ColumnSide;
  /** 16:9 set sütunu; dikeyde null. */
  column: FrameBox | null;
  /**
   * Koyu gradyanın başladığı (şeffaf) ve tam koyulaştığı nokta, gradyan yönünde kenardan uzaklık:
   * dikeyde üstten y; yatayda sütun sağdaysa soldan x, soldaysa sağdan x.
   */
  shadeStart: number;
  shadeSolid: number;
  /**
   * Tam kadraj maç fotoğrafında yüzlerin durması gereken yazısız bölge (kart pikseli): dikeyde
   * başlık satırının altı ile gradyan başlangıcı arası, yatayda sütunun karşı tarafı. Akıllı
   * kırpma (`match-photo/crop.ts`) bu kutuyu okur.
   */
  photoSafe: FrameBox;
  /** C · Manşet: üstteki büyük "MAÇ SONUCU" bandı (dikey) — üst gradyan bu bandı koyulaştırır. */
  titleBand: FrameBox | null;
}

/** C · Manşet dikey ölçüleri (k ile ölçeklenir). */
// ruleGap: başlığın Ç kuyruğu (≈ 0,25 em) + 0,08 em — bkz. headline.tsx Title.
export const HEADLINE_VERTICAL = { titleGap: 44, title: 132, rule: 6, ruleGap: 44, bandPad: 40, bottomBlock: 300, bottomRamp: 220 } as const;

function vertical(frame: MatchDayFrame, template: MatchResultTemplateId): ResultGeometry {
  const k = Math.min(1, frame.height / 1350);
  const top = frame.safeTop + SAFE_MARGIN;
  const bottom = frame.height - frame.safeBottom - SAFE_MARGIN;
  const h = HEADLINE_VERTICAL;
  const headline = template === "HEADLINE";
  // Alt blok (MVP satırı + skor şeridi + golcüler + künye) ≈ 410px → 4:5'te kartın alt %35'i;
  // Manşet'te alt blok minimal (≈300px), üstte başlık bandı var.
  const shadeSolid = bottom - Math.round((headline ? h.bottomBlock : 410) * k);
  const shadeStart = shadeSolid - Math.round((headline ? h.bottomRamp : 260) * k);
  const bandBottom = top + Math.round((h.titleGap + h.title + h.ruleGap + h.rule + h.bandPad) * k);
  const titleBand = headline ? { left: SAFE_MARGIN, right: frame.width - SAFE_MARGIN, top, bottom: bandBottom } : null;
  return {
    frame,
    k,
    top,
    bottom,
    left: SAFE_MARGIN,
    right: frame.width - SAFE_MARGIN,
    side: "right",
    column: null,
    shadeStart,
    shadeSolid,
    photoSafe: { left: SAFE_MARGIN, right: frame.width - SAFE_MARGIN, top: titleBand ? titleBand.bottom : top + Math.round(40 * k), bottom: shadeStart },
    titleBand,
  };
}

/** Gradyan sütundan bu kadar önce tam koyulaşır, bundan da `SHADE_RAMP` önce başlar. */
const SHADE_LEAD = 40;
const SHADE_RAMP = 260;

function landscape(frame: MatchDayFrame, side: ColumnSide): ResultGeometry {
  const column = landscapeColumnBox(frame, side);
  // Gradyan yönünde kenardan uzaklık: sağ sütunda soldan, sol sütunda sağdan ölçülür.
  const columnEdge = side === "right" ? column.left : frame.width - column.right;
  const shadeSolid = columnEdge - SHADE_LEAD;
  const shadeStart = shadeSolid - SHADE_RAMP;
  const photoEdge = shadeStart + LANDSCAPE_GUTTER;
  return {
    frame,
    k: 1,
    top: SAFE_MARGIN,
    bottom: frame.height - SAFE_MARGIN,
    left: SAFE_MARGIN,
    right: frame.width - SAFE_MARGIN,
    side,
    column,
    shadeStart,
    shadeSolid,
    photoSafe:
      side === "right"
        ? { left: SAFE_MARGIN, right: photoEdge, top: SAFE_MARGIN + 40, bottom: frame.height - SAFE_MARGIN }
        : { left: frame.width - photoEdge, right: frame.width - SAFE_MARGIN, top: SAFE_MARGIN + 40, bottom: frame.height - SAFE_MARGIN },
    titleBand: null,
  };
}

export function matchResultGeometry(frame: MatchDayFrame, side: ColumnSide = "right", template: MatchResultTemplateId = "FULL_FRAME"): ResultGeometry {
  return frame.orientation === "landscape" ? landscape(frame, side) : vertical(frame, template);
}
