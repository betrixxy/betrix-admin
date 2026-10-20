/**
 * Türkçe karakter duyarsız arama anahtarı: tr-TR küçük harf, Türkçe harfler ASCII karşılığına
 * ("Kökçü" → "kokcu", "İstanbul" → "istanbul", "Işık" → "isik"), diğer aksanlar atılır
 * ("Vinícius" → "vinicius"). Saf; istemci bileşenleri de kullanır.
 */

const TR_MAP: Record<string, string> = { ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u" };

export function foldTr(text: string): string {
  return text
    .toLocaleLowerCase("tr-TR")
    .replace(/[çğıöşü]/g, (letter) => TR_MAP[letter] ?? letter)
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Sorgunun her sözcüğü metinde geçiyor mu ("orkun kok" → "Orkun Kökçü" eşleşir). */
export function matchesQuery(text: string, query: string): boolean {
  const haystack = foldTr(text);
  return foldTr(query)
    .split(" ")
    .filter(Boolean)
    .every((word) => haystack.includes(word));
}
