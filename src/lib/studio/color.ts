/** "#RRGGBB" -> "r, g, b" (inline style / CSS var içinde kullanmak için) */
export function hexToRgbChannels(hex: string): string {
  const normalized = hex.replace("#", "");
  const r = parseInt(normalized.substring(0, 2), 16);
  const g = parseInt(normalized.substring(2, 4), 16);
  const b = parseInt(normalized.substring(4, 6), 16);
  return `${r}, ${g}, ${b}`;
}

export function hexToRgba(hex: string, alpha: number): string {
  return `rgba(${hexToRgbChannels(hex)}, ${alpha})`;
}
