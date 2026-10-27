/**
 * Sayı yazımı — ORTAK katman: kartlarda ve gönderi metinlerinde her sayı buradan geçer (tr-TR: ondalık
 * virgül, binlik nokta). Kartlarda `toFixed` / ham `String(sayı)` ile ondalık yazılmaz (bkz.
 * tests/unit/number-format.test.ts — kaynak taraması). Tam sayılar `String()` ile yazılabilir.
 *
 *   formatNumber(1.8) → "1,8" · formatNumber(0.72) → "0,72" · formatNumber(2) → "2"
 *   formatNumber(1.16, { decimals: 2 }) → "1,16" (sabit basamak: tablo hizası)
 *   formatNumber(1.84, { maxDecimals: 1 }) → "1,8"
 */

export interface NumberFormatOptions {
  /** Sabit ondalık basamak (en az = en çok). */
  decimals?: number;
  /** En fazla ondalık basamak (sondaki sıfırlar yazılmaz); varsayılan 2. */
  maxDecimals?: number;
}

const formats = new Map<string, Intl.NumberFormat>();

export function formatNumber(value: number, options: NumberFormatOptions = {}): string {
  const min = options.decimals ?? 0;
  const max = options.decimals ?? options.maxDecimals ?? 2;
  const key = `${min}:${max}`;
  let format = formats.get(key);
  if (!format) {
    format = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: min, maximumFractionDigits: max });
    formats.set(key, format);
  }
  // -0 ("-0") yazılmaz.
  return format.format(Object.is(value, -0) ? 0 : value);
}
