import { percentWidth } from "./parts";

/**
 * Vitrin 01 kazanma çubuğunun altındaki üç sütun (yüzde + etiket) — saf yerleşim (2026-10-31). Canlı testte
 * %64 / %19 / %17 dağılımında beraberlik etiketi segmentin ortasına, deplasman etiketi sağa yaslıydı ve
 * "BERABERLİK" ile "GAZİANTEP FK" birbirine değdi: eski hesap yalnızca YÜZDE genişliklerini sıkıştırıyordu,
 * etiket genişliğini hiç bilmiyordu. Kural: her sütunun genişliği yüzdesi ile etiketinden genişi; beraberlik
 * sütunu kendi segmentinin ortasında, iki uç sütuna `gap`'ten yaklaşmayacak şekilde sıkıştırılır; üç sütun
 * yan yana sığmıyorsa etiket puntosu küçülür (en az `minLabel`). Kapı ayrıca mürekkep düzeyinde denetler.
 */

/** Geist 700 büyük harf, harf aralığı 0,12 em — karakter başı genişlik (em), cömert (ölçülen ≈ 0,74). */
export const BAR_LABEL_EM = 0.8;

export const barLabelWidth = (text: string, size: number): number => Math.ceil([...text].length * size * BAR_LABEL_EM);

export interface WinBarColumns {
  labelSize: number;
  /** Sütun genişlikleri: ev (sola yaslı, x = 0), beraberlik, deplasman (sağa yaslı). */
  widths: [number, number, number];
  /** Beraberlik sütununun sol kenarı. */
  drawLeft: number;
}

export interface WinBarColumnInput {
  values: [number, number, number];
  labels: [string, string, string];
  /** Çubuğun toplam genişliği. */
  width: number;
  /** Beraberlik segmentinin ortası (çubuk koordinatı). */
  drawSegmentCenter: number;
  percentSize: number;
  labelSize: number;
  minLabel: number;
  gap: number;
}

export function winBarColumns(input: WinBarColumnInput): WinBarColumns {
  const { values, labels, width, gap, percentSize } = input;
  const widthsAt = (size: number) => values.map((value, index) => Math.max(percentWidth(value, percentSize), barLabelWidth(labels[index] ?? "", size))) as [number, number, number];
  let labelSize = input.labelSize;
  let widths = widthsAt(labelSize);
  while (labelSize > input.minLabel && widths[0] + widths[1] + widths[2] + 2 * gap > width) {
    labelSize -= 1;
    widths = widthsAt(labelSize);
  }
  const [home, draw, away] = widths;
  const minCenter = home + gap + draw / 2;
  const maxCenter = width - away - gap - draw / 2;
  // Sığmıyorsa (en küçük puntoda bile) ortalanır — kapı mürekkep temasını yakalar, kart üretilmez.
  const center = minCenter > maxCenter ? (minCenter + maxCenter) / 2 : Math.min(maxCenter, Math.max(minCenter, input.drawSegmentCenter));
  return { labelSize, widths, drawLeft: Math.round(center - draw / 2) };
}
