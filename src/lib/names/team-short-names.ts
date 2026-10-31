/**
 * Takım KISA kart adı — TEK KAYNAK (2026-10-31, canlı test: "Borussia Mönchengladbach" vitrin 02 göstergesini,
 * kazanma çubuğu etiketlerini taşırdı). Türk yayıncı kullanımı: dar alanlarda ("M'gladbach", "Paderborn",
 * "Karagümrük") kısa ad, posterde/başlıkta uzun kart adı (`archive/names.ts::cardTeamName`). Hangi alanın
 * hangi biçimi yazdığı `team-name-forms.ts`'te.
 *
 * Sıra: (1) tablo — anahtar KART ADI (`cardTeamName` çıktısı; kartların taşıdığı tek ad budur, takım kimliği
 * her kart tipinde yok), (2) kural — ad `SHORT_MAX` karakterden uzunsa kulüp ön eki (FC, SC, AC, SSC, 1., Borussia…)
 * ve sonek (FC, SK, FK, 07, 1899…) atılır; kalan boşsa ad olduğu gibi, (3) ad olduğu gibi. Kısa ad büyütülürken
 * uzun adla aynı köken kuralından geçer (`upperTeamName`). Tabloya yeni ad eklemek yayıncı kullanımına göre
 * kullanıcı kararıdır.
 */

/** Bu uzunluğa kadar ad dar alanda da olduğu gibi yazılır (ör. "Gaziantep FK", "Galatasaray"). */
export const SHORT_MAX = 12;

/** Kart adı → yayıncı kısa adı (kapsanan 10 lig + Avrupa kupaları; yalnızca kurala bırakılamayanlar). */
export const TEAM_SHORT_NAMES: Readonly<Record<string, string>> = {
  // Bundesliga
  "Borussia Mönchengladbach": "M'gladbach",
  "Borussia Monchengladbach": "M'gladbach",
  "SC Paderborn 07": "Paderborn",
  "Eintracht Frankfurt": "Frankfurt",
  "Bayer Leverkusen": "Leverkusen",
  "1. FC Heidenheim": "Heidenheim",
  "FC Heidenheim": "Heidenheim",
  "1. FC Union Berlin": "Union Berlin",
  "Union Berlin": "Union Berlin",
  "Werder Bremen": "Bremen",
  "VfL Wolfsburg": "Wolfsburg",
  "FSV Mainz 05": "Mainz",
  "1. FC Köln": "Köln",
  "Hamburger SV": "Hamburg",
  "FC St. Pauli": "St. Pauli",
  // Premier Lig
  "Wolverhampton Wanderers": "Wolves",
  "Nottingham Forest": "Nottingham",
  "Brighton & Hove Albion": "Brighton",
  "Brighton and Hove Albion": "Brighton",
  "Manchester United": "Man. United",
  "Manchester City": "Man. City",
  "Newcastle United": "Newcastle",
  "Crystal Palace": "C. Palace",
  "Tottenham Hotspur": "Tottenham",
  "West Ham United": "West Ham",
  // LaLiga
  "Atletico Madrid": "Atlético",
  "Atlético Madrid": "Atlético",
  "Rayo Vallecano": "Rayo",
  "Deportivo Alaves": "Alaves",
  "Real Sociedad": "R. Sociedad",
  // Serie A / Ligue 1
  "Paris Saint-Germain": "PSG",
  "Olympique Lyonnais": "Lyon",
  "Olympique Marseille": "Marsilya",
  "Stade Brestois 29": "Brest",
  // Türkiye
  "Fatih Karagümrük": "Karagümrük",
  "Esenler Erokspor": "Erokspor",
  "Batman Petrolspor": "Petrolspor",
  "Çaykur Rizespor": "Rizespor",
  // Avrupa kupaları
  "Union Saint-Gilloise": "Union SG",
  "Shakhtar Donetsk": "Şahtar",
  "Şahtar Donetsk": "Şahtar",
};

/** Ön ekler (yalnızca adın başında) ve sonekler (yalnızca sonunda) — sözcük olarak. */
const PREFIXES = new Set(["fc", "sc", "ac", "as", "ssc", "ss", "us", "sv", "vfb", "vfl", "tsg", "rc", "rcd", "cf", "cd", "ud", "sd", "ogc", "afc", "1.", "borussia", "olympique", "stade", "real"]);
const SUFFIXES = new Set(["fc", "cf", "sk", "fk", "jk", "sfk", "afc", "bk", "kv", "sc", "05", "07", "04", "29", "1899", "1846", "1907", "1909", "1913"]);

const key = (word: string) => word.toLocaleLowerCase("en-US");

/** Kural: uzun addan kulüp ön/son ekleri atılır (en az bir sözcük kalır). */
export function ruleShortName(name: string): string {
  const words = name.trim().split(/\s+/u).filter(Boolean);
  if (words.join(" ").length <= SHORT_MAX) return words.join(" ");
  let start = 0;
  let end = words.length;
  while (start < end - 1 && PREFIXES.has(key(words[start] ?? ""))) start += 1;
  while (end - 1 > start && SUFFIXES.has(key(words[end - 1] ?? ""))) end -= 1;
  return words.slice(start, end).join(" ");
}

/** Kartın kısa takım adı (büyütülmemiş): tablo → kural → ad. */
export function shortTeamName(cardName: string): string {
  const name = cardName.trim();
  return TEAM_SHORT_NAMES[name] ?? ruleShortName(name);
}
