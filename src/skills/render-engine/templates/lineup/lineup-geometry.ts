import type { FrameBox } from "@/skills/render-engine/templates/match-result/geometry";
import { SOCIAL_FORMATS, type SocialFormatId } from "@/types/studio-formats";

/**
 * Muhtemel 11 kartının format geometrisi — TEK KAYNAK (çerçeve, taktik tahtası, liste ve kapak ölçüsü
 * buradan okur). Üç yerleşim ailesi:
 *
 * - **4:5 / 9:16 (dikey):** üstte başlık, ortada içerik, altta imza bandı. Story, 4:5 yerleşiminin
 *   platform bantları (üst 250 / alt 320px, CLAUDE.md 3.3) kadar içeri alınmış halidir — kritik içerik bantlara girmez.
 * - **1:1 (kare):** aynı aile, tipografi `k` ile küçülür; içerik alanı geniş-basık olduğundan saha yatay çizilir.
 * - **16:9 (yatay):** solda başlık + künye sütunu, sağda yatay saha (ya da kapak + liste) — tasarım
 *   yatay eksene yayılır, dikey yerleşim basıklaştırılmaz.
 */
export interface LineupGeometry {
  width: number;
  height: number;
  pad: number;
  landscape: boolean;
  /** Tipografi/işaret ölçeği (4:5 = 1). */
  k: number;
  /** Başlık bloğu kutusu. */
  header: { left: number; top: number; width: number };
  /** İçerik alanı (saha / liste paneli). */
  content: { left: number; top: number; width: number; height: number };
  /** Saha yatay mı (hücum sağa)? */
  horizontalPitch: boolean;
  /** Dikey ailede: alt imza bandının üstü (bant kanvas altına kadar iner) ve bant içeriğinin alttan boşluğu. */
  footerTop: number;
  footerInset: number;
  /** Kahraman Liste: kapak fotoğrafının bölgesi ve liste paneli. */
  photo: LineupPhotoGeometry;
  panel: { left: number; top: number; width: number; height: number };
}

/**
 * Kahraman Liste kapağı (Vitrin hattı: kalite kapısı, yüz tespiti, akıllı kırpma, split-tone, takım ışığı).
 * `box` kanvas koordinatında fotoğraf bölgesi (kanvasın üst/alt kenarına kadar — başlık ve imza bandı
 * fotoğrafın üstüne biner); `safe` box'a GÖRE yüzün düşeceği yazısız bölge (başlığın altı, bandın üstü,
 * listenin solu); `fade` box'a göre x: fotoğrafın zemine söndüğü aralık(lar) — listenin arkasında yumuşar.
 */
export interface LineupPhotoGeometry {
  box: FrameBox;
  safe: FrameBox;
  fade: { left: [number, number] | null; right: [number, number] };
}

/** 4:5'in birebir ölçüleri (ilk tasarım) — Story bunları `safeTop` kadar aşağı kaydırır. */
function vertical(formatId: "post" | "story"): LineupGeometry {
  const { width, height, safeTop, safeBottom } = SOCIAL_FORMATS[formatId];
  const contentTop = safeTop + 330;
  const contentBottom = safeTop + 1120;
  return {
    width,
    height,
    pad: 56,
    landscape: false,
    k: 1,
    header: { left: 56, top: safeTop + 52, width: width - 112 },
    content: { left: 60, top: contentTop - 14, width: width - 120, height: contentBottom - contentTop + 4 },
    horizontalPitch: false,
    footerTop: height - safeBottom - 230,
    footerInset: 50 + safeBottom,
    photo: {
      box: { left: 0, top: 0, right: 640, bottom: height },
      safe: { left: 40, top: contentTop, right: 500, bottom: height - safeBottom - 230 },
      fade: { left: null, right: [470, 640] },
    },
    panel: { left: 540, top: contentTop - 10, width: 490, height: contentBottom - contentTop + 10 },
  };
}

function square(): LineupGeometry {
  const { width, height } = SOCIAL_FORMATS.square;
  const k = 0.8;
  const footerTop = height - 184;
  const contentTop = 262;
  return {
    width,
    height,
    pad: 48,
    landscape: false,
    k,
    header: { left: 48, top: 40, width: width - 96 },
    content: { left: 48, top: contentTop - 10, width: width - 96, height: footerTop - contentTop + 4 },
    horizontalPitch: true,
    footerTop,
    footerInset: 38,
    photo: {
      box: { left: 0, top: 0, right: 660, bottom: height },
      safe: { left: 40, top: contentTop, right: 520, bottom: footerTop },
      fade: { left: null, right: [500, 660] },
    },
    panel: { left: 556, top: contentTop - 8, width: 476, height: footerTop - contentTop + 8 },
  };
}

function landscape(): LineupGeometry {
  const { width, height } = SOCIAL_FORMATS.landscape;
  const pad = 56;
  const column = 760;
  const contentLeft = pad + column + 40;
  return {
    width,
    height,
    pad,
    landscape: true,
    k: 1,
    header: { left: pad, top: pad, width: column },
    content: { left: contentLeft, top: pad, width: width - contentLeft - pad, height: height - pad * 2 },
    horizontalPitch: true,
    footerTop: height,
    footerInset: pad,
    // Başlık sütunu (56–816) ile liste (1304–1864) arasında; iki yana söner.
    photo: {
      box: { left: 760, top: 0, right: 1400, bottom: height },
      safe: { left: 110, top: pad + 40, right: 500, bottom: height - pad - 40 },
      fade: { left: [0, 140], right: [480, 640] },
    },
    panel: { left: width - pad - 560, top: pad, width: 560, height: height - pad * 2 },
  };
}

export function lineupGeometry(formatId: SocialFormatId): LineupGeometry {
  switch (formatId) {
    case "post":
    case "story":
      return vertical(formatId);
    case "square":
      return square();
    case "landscape":
      return landscape();
  }
}
