/** API-Football arama parametresi en az 3 karakter ister; harf/rakam/boşluk dışını atar. */
export function apiSearchTerm(query: string): string | null {
  const term = query.normalize("NFC").replace(/[^\p{L}\p{N} ]/gu, " ").replace(/\s+/g, " ").trim();
  return term.length >= 3 ? term : null;
}
