/**
 * Kart verisi boşluk bekçisi (2026-10-31): görünür metinlerde çift boşluk ya da baş/son boşluk. Künye ayıracı
 * "  ·  " (ayıraca bitişik boşluk dizisi) bilerek geniştir. Görsel testler her kart nesnesini bundan geçirir;
 * render sınırı ayrıca `satori-text.tsx::tidyText` ile çift boşluğu tek boşluğa indirir.
 */
const DOUBLE_SPACE = /(?<![·\s]) {2,}(?![·\s])/u;
const NON_TEXT_KEY = /(hex|url|logo|photo|image|src|color|id)$/iu;

export function textSpacingProblems(card: unknown, at = "kart"): string[] {
  if (typeof card === "string") {
    if (!/\p{L}/u.test(card) || /^(data:|https?:|\/api\/)/u.test(card)) return [];
    const problems: string[] = [];
    if (card !== card.trim()) problems.push(`${at}: baş/son boşluk ${JSON.stringify(card)}`);
    if (DOUBLE_SPACE.test(card)) problems.push(`${at}: çift boşluk ${JSON.stringify(card)}`);
    return problems;
  }
  if (Array.isArray(card)) return card.flatMap((item, index) => textSpacingProblems(item, `${at}.${index}`));
  if (card && typeof card === "object") {
    return Object.entries(card).filter(([key]) => !NON_TEXT_KEY.test(key)).flatMap(([key, value]) => textSpacingProblems(value, `${at}.${key}`));
  }
  return [];
}
