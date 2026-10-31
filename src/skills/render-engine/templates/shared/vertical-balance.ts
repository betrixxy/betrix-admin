/**
 * Dikey denge — TEK KURAL (canlı test 2026-10-31: 9:16 Story'lerde ve Tahmin Karnesi'nde içerik üst %60'ta
 * toplanıyor, künyenin üstünde boş bant kalıyordu). Dikey formatlarda (4:5, 1:1, 9:16) içerik yığını (başlıktan
 * son satıra) künyeye kadar olan alanı doldurmuyorsa:
 *   1. önce ölçek büyür (en çok `maxScale` — yazı da büyür; genişlik sınırı çağıranın),
 *   2. kalan boşluk yığının ÜSTÜ ve ALTI arasında eşit bölünür (yığın aşağı kayar).
 * Ölçülebilir hedef (görsel testlerde `verticalGaps` ile): içerikle künye arasındaki boşluk, güvenli alanın
 * tepesiyle içerik arasındaki boşluğun en çok `BALANCE_RATIO` katı (ve ikisi de alanın en çok `MAX_GAP_SHARE`'i).
 */

export const BALANCE_RATIO = 2;
export const MAX_GAP_SHARE = 0.16;

export interface VerticalFill {
  /** İçerik ölçeği (1 = doğal). */
  scale: number;
  /** Yığının aşağı kayması (px). */
  offset: number;
}

/**
 * `natural`: yığının ölçek 1'deki yüksekliği; `available`: yığının sığabileceği alan; `fixed`: ölçekle büyümeyen
 * kısım (ör. satır yüksekliği sınırı olmayan boşluklar yoksa 0). Ölçek `maxScale`'i geçmez; sığmıyorsa 1.
 */
export function balanceVertical(natural: number, available: number, maxScale: number): VerticalFill {
  if (natural <= 0 || available <= natural) return { scale: 1, offset: 0 };
  const scale = Math.max(1, Math.min(maxScale, available / natural));
  const offset = Math.max(0, Math.floor((available - natural * scale) / 2));
  return { scale, offset };
}

export interface GapBox {
  top: number;
  bottom: number;
}

/**
 * Ölçüm (görsel test): içerik bloklarının dikey birleşimi ile künye bloğu arasındaki boşluk (`bottom`) ve
 * güvenli alan tepesiyle ilk içerik arasındaki boşluk (`top`).
 */
export function verticalGaps(content: readonly GapBox[], footerTop: number, safeTop: number): { top: number; bottom: number } {
  const top = Math.min(...content.map((box) => box.top));
  const bottom = Math.max(...content.map((box) => box.bottom));
  return { top: Math.max(0, top - safeTop), bottom: Math.max(0, footerTop - bottom) };
}

/** Kural ihlali varsa okunur sebep, yoksa null. `height`: güvenli alanın yüksekliği. */
export function balanceProblem(gaps: { top: number; bottom: number }, height: number): string | null {
  const limit = Math.max(BALANCE_RATIO * gaps.top, 0);
  const share = gaps.bottom / height;
  if (gaps.bottom > limit && share > MAX_GAP_SHARE / 2) return `alt boşluk ${Math.round(gaps.bottom)}px > üst boşluk ${Math.round(gaps.top)}px × ${BALANCE_RATIO}`;
  if (share > MAX_GAP_SHARE) return `alt boşluk alanın %${Math.round(share * 100)}'i (sınır %${Math.round(MAX_GAP_SHARE * 100)})`;
  return null;
}
