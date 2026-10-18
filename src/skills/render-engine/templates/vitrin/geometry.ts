import type { MatchDayFrame } from "@/lib/dashboard/match-day-formats";
import { px } from "../match-day/shared";
import { SAFE_MARGIN, type FrameBox } from "../match-result/geometry";

/**
 * Vitrin kartı geometrisi — TEK KAYNAK: Satori şablonu, kilitli kutu yer tutucu katmanı ve tam
 * kadraj fotoğrafın akıllı kırpması (`photoSafe`) aynı sayıları okur.
 *
 * Dikey (4:5, 1:1, 9:16): üstte sayfa etiketi + tarih ve fotoğraf; alttan yukarı sabitlenmiş yığın:
 * künye ← kanca ← kilitli kutular ← 2. açık kutu ← 1. açık kutu ← takımlar. Temel ölçüler 4:5'te
 * k = 1; 9:16 platform bantlarını boş bırakır (kalan alan 4:5 ile aynı), 1:1 `k` ile küçülür.
 * 16:9: fotoğraf solda, yığın sağ sütunda (`k` sütuna sığacak kadar).
 */

/** Temel (k = 1) blok yükseklikleri ve boşluklar. Üç taraflı açık kutu (1X2, ilk yarı) daha yüksek. */
export const VITRIN_SIZES = {
  header: 18,
  headerGap: 36,
  teams: 60,
  openTriple: 236,
  openSingle: 214,
  locked: 160,
  hook: 66,
  gap: 22,
  footerSize: 23,
  logoHeight: 34,
  footerGap: 30,
  /** Dikeyde fotoğrafa kalan asgari yükseklik (k hesabı). */
  minPhoto: 220,
} as const;

/** 16:9 sütununun başladığı yer (kart genişliğinin oranı) ve kenar boşlukları. */
const LANDSCAPE_COLUMN_START = 0.47;
const LANDSCAPE_MARGIN = { x: SAFE_MARGIN, y: SAFE_MARGIN } as const;

export interface BlockSlot {
  top: number;
  height: number;
}

export interface VitrinGeometry {
  frame: MatchDayFrame;
  k: number;
  /** Başlık (etiket + tarih) ve künyenin kutusu; dikeyde içerik kutusu, yatayda sağ sütun. */
  box: FrameBox;
  /** Takımlar · açık kutular · kilitli kutular · kanca bu yatay aralıkta. */
  stackLeft: number;
  stackRight: number;
  teams: BlockSlot;
  open: [BlockSlot, BlockSlot];
  locked: BlockSlot;
  hook: BlockSlot;
  /** Koyu gradyan: dikeyde üstten y, yatayda soldan x — `start` şeffaf, `solid` tam koyu. */
  shade: { direction: "down" | "right"; start: number; solid: number };
  /** Fotoğrafta yüzlerin durması gereken yazısız bölge. */
  photoSafe: FrameBox;
}

/** Açık kutunun temel yüksekliği: üç taraflı mı (1X2/ilk yarı) tek sonuçlu mu. */
const openHeight = (triple: boolean) => (triple ? VITRIN_SIZES.openTriple : VITRIN_SIZES.openSingle);

/** Yığının (takımlar → künye) temel yüksekliği. */
function stackHeight(triples: [boolean, boolean]): number {
  const s = VITRIN_SIZES;
  return s.teams + openHeight(triples[0]) + openHeight(triples[1]) + s.locked + s.hook + 4 * s.gap + s.gap + s.logoHeight + s.footerGap;
}

/** Alttan yukarı blok yerleşimi (künye → kanca → kilitli → açık 2 → açık 1 → takımlar). */
function placeStack(bottom: number, k: number, triples: [boolean, boolean]) {
  const s = VITRIN_SIZES;
  const hookBottom = bottom - px(s.logoHeight, k) - px(s.footerGap, k);
  const hook = { top: hookBottom - px(s.hook, k), height: px(s.hook, k) };
  const locked = { top: hook.top - px(s.gap, k) - px(s.locked, k), height: px(s.locked, k) };
  const open2 = { top: locked.top - px(s.gap, k) - px(openHeight(triples[1]), k), height: px(openHeight(triples[1]), k) };
  const open1 = { top: open2.top - px(s.gap, k) - px(openHeight(triples[0]), k), height: px(openHeight(triples[0]), k) };
  const teams = { top: open1.top - px(s.gap, k) - px(s.teams, k), height: px(s.teams, k) };
  return { teams, open: [open1, open2] as [BlockSlot, BlockSlot], locked, hook };
}

export function vitrinGeometry(frame: MatchDayFrame, triples: [boolean, boolean]): VitrinGeometry {
  const s = VITRIN_SIZES;
  if (frame.orientation === "landscape") {
    const box = { left: Math.round(frame.width * LANDSCAPE_COLUMN_START), right: frame.width - LANDSCAPE_MARGIN.x, top: LANDSCAPE_MARGIN.y, bottom: frame.height - LANDSCAPE_MARGIN.y };
    const k = Math.min(1, (box.bottom - box.top) / (s.header + s.headerGap + stackHeight(triples)));
    return {
      frame,
      k,
      box,
      stackLeft: box.left,
      stackRight: box.right,
      ...placeStack(box.bottom, k, triples),
      shade: { direction: "right", start: box.left - 260, solid: box.left - 36 },
      photoSafe: { left: LANDSCAPE_MARGIN.x, right: box.left - 120, top: LANDSCAPE_MARGIN.y, bottom: frame.height - LANDSCAPE_MARGIN.y },
    };
  }
  const box = { left: SAFE_MARGIN, right: frame.width - SAFE_MARGIN, top: frame.safeTop + SAFE_MARGIN, bottom: frame.height - frame.safeBottom - SAFE_MARGIN };
  const k = Math.min(1, (box.bottom - box.top) / (s.header + s.headerGap + s.minPhoto + stackHeight(triples)));
  const placed = placeStack(box.bottom, k, triples);
  const solid = placed.teams.top - px(14, k);
  const start = Math.max(box.top + px(s.header + s.headerGap, k), solid - px(230, k));
  return {
    frame,
    k,
    box,
    stackLeft: box.left,
    stackRight: box.right,
    ...placed,
    shade: { direction: "down", start, solid },
    photoSafe: { left: box.left, right: box.right, top: box.top + px(s.header + s.headerGap, k), bottom: start },
  };
}
