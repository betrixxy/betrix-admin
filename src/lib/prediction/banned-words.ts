/**
 * Dil kapısı — Türk hesabı için bahis dili YOK (kurucu kararı, 2026-10-19). Vitrin kartının bütün
 * metinleri (başlık, sonuç etiketi, gerekçe, kanca) ve gönderi metni buradan geçer; bulgu varsa kart
 * üretilmez. Liste testle sabittir (`tests/unit/prediction.test.ts`).
 *
 * Eşleme tr-TR küçük harfle, Türkçe harflere göre sözcük sınırıyla yapılır:
 *  - TAM SÖZCÜK: "alt", "üst", "oran", "kg", "ms1/msx/ms2" — "altyapı", "üstün", "pas isabet oranı" geçer.
 *  - EKLİ HALİYLE: "bahis…", "iddaa…", "kupon…", "banko…", "market…" ("bahisçi", "kuponu").
 *  - İFADE: "karşılıklı gol" (ekli halleri dahil: "karşılıklı goller").
 *  - İSTİSNA: "üst üste" ("üst üste 3 maç kazandı") serbest; "üst" yalnızca tek başına yasaklı.
 */

export const BANNED_WORDS = ["MS1", "MSX", "MS2", "KG", "karşılıklı gol", "alt", "üst", "oran", "kupon", "bahis", "iddaa", "market", "banko"] as const;

const EXACT = new Set(["ms1", "msx", "ms2", "kg", "alt", "üst", "oran"]);
const PREFIXES = ["bahis", "iddaa", "kupon", "banko", "market"];
const LETTER = "\\p{L}\\p{N}";

/** Metinde geçen yasaklı sözcükler (listedeki yazımıyla, tekrarsız). Boş dizi = temiz. */
export function findBannedWords(text: string): string[] {
  const lower = text.normalize("NFC").toLocaleLowerCase("tr-TR");
  const found = new Set<string>();
  if (new RegExp(`(^|[^${LETTER}])karşılıklı\\s+gol`, "u").test(lower)) found.add("karşılıklı gol");
  // "üst üste" istisnası: ifade sözcük taramasından önce çıkarılır; tek başına "üst" yasaklı kalır.
  const scanned = lower.replace(new RegExp(`(^|[^${LETTER}])üst\\s+üste(?![${LETTER}])`, "gu"), "$1 ");
  for (const token of scanned.match(new RegExp(`[${LETTER}]+`, "gu")) ?? []) {
    if (EXACT.has(token)) found.add(token);
    const prefix = PREFIXES.find((word) => token.startsWith(word));
    if (prefix) found.add(prefix);
  }
  return BANNED_WORDS.filter((word) => found.has(word.toLocaleLowerCase("tr-TR")));
}

/** Kapı: alan adı → metin. Bulgu varsa okunur bir sebep döner, yoksa null. */
export function bannedWordsGate(fields: Record<string, string>): string | null {
  const hits = Object.entries(fields).flatMap(([label, text]) => {
    const words = findBannedWords(text);
    return words.length ? [`${label}: ${words.join(", ")}`] : [];
  });
  return hits.length ? `Bahis dili yasak — ${hits.join(" · ")}` : null;
}
