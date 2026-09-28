const numberFormatter = new Intl.NumberFormat("tr-TR");
const compactFormatter = new Intl.NumberFormat("tr-TR", { notation: "compact", maximumFractionDigits: 1 });
const percentFormatter = new Intl.NumberFormat("tr-TR", { style: "percent", maximumFractionDigits: 1 });

export function formatNumber(value: number): string {
  return numberFormatter.format(value);
}

export function formatCompactNumber(value: number): string {
  return compactFormatter.format(value);
}

export function formatPercent(ratio: number): string {
  return percentFormatter.format(ratio);
}
