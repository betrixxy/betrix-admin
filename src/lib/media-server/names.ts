/**
 * İsim / ülke normalizasyonu ve benzerlik — saf fonksiyonlar (birim testli).
 * "Sıfır hata" ilkesi: normalizasyon yalnızca yazım farkını (aksan, büyük/küçük harf, noktalama)
 * siler; anlam değiştiren hiçbir dönüşüm (kısaltma açma, takma ad) yapmaz.
 */

const SPECIAL_LETTERS: Record<string, string> = {
  ı: "i", ø: "o", æ: "ae", œ: "oe", ß: "ss", đ: "d", ð: "d", ł: "l", þ: "th", ħ: "h",
};

/** "Mesut Özil" → "mesut ozil", "N'Golo Kanté" → "n golo kante". */
export function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[ıøæœßđðłþħ]/g, (ch) => SPECIAL_LETTERS[ch] ?? ch)
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function nameTokens(value: string): string[] {
  const normalized = normalizeName(value);
  return normalized === "" ? [] : normalized.split(" ");
}

/**
 * Kulüp adlarındaki tür ekleri — yalnızca takım eşleştirmesinin ikinci kademesinde atılır
 * ("Real Madrid CF" ↔ "Real Madrid"). Liste bilerek kısa tutulur.
 */
const CLUB_AFFIXES = new Set([
  "fc", "cf", "afc", "sc", "fk", "sk", "ac", "as", "cd", "ud", "sv", "bk", "if", "jk", "kv", "club",
]);

export function stripClubAffixes(value: string): string {
  return nameTokens(value)
    .filter((token) => !CLUB_AFFIXES.has(token))
    .join(" ");
}

/** FM ve API-Football farklı ülke adları kullanır — yalnızca bilinen eşdeğerler. */
const COUNTRY_ALIASES: Record<string, string> = {
  turkiye: "turkey",
  czechia: "czech republic",
  "united states": "usa",
  "korea republic": "south korea",
  "republic of ireland": "ireland",
  holland: "netherlands",
  "bosnia and herzegovina": "bosnia",
  "cote d ivoire": "ivory coast",
  "dr congo": "congo dr",
  "china pr": "china",
};

export function normalizeCountry(value: string): string {
  const normalized = normalizeName(value);
  return COUNTRY_ALIASES[normalized] ?? normalized;
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const curr = [i];
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr.push(Math.min((prev[j] ?? 0) + 1, (curr[j - 1] ?? 0) + 1, (prev[j - 1] ?? 0) + cost));
    }
    prev = curr;
  }
  return prev[b.length] ?? Math.max(a.length, b.length);
}

/**
 * 0..1 arası benzerlik — yalnızca manuel kontrol adaylarını sıralamak için kullanılır,
 * kesin eşleşme kararında ASLA kullanılmaz.
 */
export function nameSimilarity(a: string, b: string): number {
  const ta = nameTokens(a);
  const tb = nameTokens(b);
  if (ta.length === 0 || tb.length === 0) return 0;
  const setB = new Set(tb);
  const common = new Set(ta.filter((t) => setB.has(t))).size;
  const dice = (2 * common) / (new Set(ta).size + setB.size);
  const sa = [...ta].sort().join(" ");
  const sb = [...tb].sort().join(" ");
  const edit = 1 - levenshtein(sa, sb) / Math.max(sa.length, sb.length);
  return Math.max(dice, edit);
}

/** Tüm `subset` parçaları `superset` içinde mi? */
export function tokensContained(subset: string[], superset: string[]): boolean {
  const set = new Set(superset);
  return subset.every((token) => set.has(token));
}
