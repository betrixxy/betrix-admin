import type { StatBar, StatRowDef, StatRowKey, StatRowValue, StatSection, StatTone } from "@/types/match-stats";

/**
 * Maç İstatistikleri satır kataloğu ve çubuk kuralları — saf (istemci de içe aktarabilir).
 * Her satır `kind` + `higherIsBetter` taşır; çubuk ve ton bu iki alandan türetilir, şablon
 * hiçbir oranı kendisi hesaplamaz.
 */

const row = (def: Omit<StatRowDef, "hideWhenZero" | "decimals" | "percent"> & Partial<StatRowDef>): StatRowDef => ({
  hideWhenZero: false,
  decimals: 0,
  percent: false,
  ...def,
});

export const STAT_ROWS: Record<StatRowKey, StatRowDef> = {
  possession: row({ key: "possession", label: "Top hakimiyeti", kind: "share100", higherIsBetter: true, section: "PASSING", percent: true }),
  xg: row({ key: "xg", label: "Beklenen gol ({xG})", kind: "count", higherIsBetter: true, section: "ATTACK", decimals: 2 }),
  shotsTotal: row({ key: "shotsTotal", label: "Toplam şut", kind: "count", higherIsBetter: true, section: "ATTACK" }),
  shotsOnTarget: row({ key: "shotsOnTarget", label: "İsabetli şut", kind: "count", higherIsBetter: true, section: "ATTACK" }),
  bigChancesMissed: row({ key: "bigChancesMissed", label: "Kaçan net pozisyon", kind: "count", higherIsBetter: null, section: "ATTACK" }),
  dangerousAttacks: row({ key: "dangerousAttacks", label: "Tehlikeli atak", kind: "count", higherIsBetter: true, section: "ATTACK" }),
  corners: row({ key: "corners", label: "Korner", kind: "count", higherIsBetter: true, section: "ATTACK" }),
  passAccuracy: row({ key: "passAccuracy", label: "Pas isabeti", kind: "rate", higherIsBetter: true, section: "PASSING", percent: true }),
  saves: row({ key: "saves", label: "Kaleci kurtarışı", kind: "count", higherIsBetter: true, section: "DEFENCE" }),
  shotsOffTarget: row({ key: "shotsOffTarget", label: "İsabetsiz şut", kind: "count", higherIsBetter: null, section: "ATTACK" }),
  shotsBlocked: row({ key: "shotsBlocked", label: "Engellenen şut", kind: "count", higherIsBetter: null, section: "ATTACK" }),
  shotsInsideBox: row({ key: "shotsInsideBox", label: "Ceza sahası içi şut", kind: "count", higherIsBetter: true, section: "ATTACK" }),
  woodwork: row({ key: "woodwork", label: "Direkten dönen", kind: "count", higherIsBetter: null, section: "ATTACK", hideWhenZero: true }),
  offsides: row({ key: "offsides", label: "Ofsayt", kind: "count", higherIsBetter: null, section: "ATTACK" }),
  passes: row({ key: "passes", label: "Pas", kind: "count", higherIsBetter: true, section: "PASSING" }),
  tacklesInterceptions: row({ key: "tacklesInterceptions", label: "Top çalma ve müdahale", kind: "count", higherIsBetter: true, section: "DEFENCE" }),
  fouls: row({ key: "fouls", label: "Faul", kind: "count", higherIsBetter: null, section: "DISCIPLINE" }),
  yellowCards: row({ key: "yellowCards", label: "Sarı kart", kind: "count", higherIsBetter: null, section: "DISCIPLINE" }),
  redCards: row({ key: "redCards", label: "Kırmızı kart", kind: "count", higherIsBetter: null, section: "DISCIPLINE", hideWhenZero: true }),
};

/** Özet (02) en fazla bu kadar satır; ilki kahraman satır (top hakimiyeti). */
export const SUMMARY_SIZE = 8;
export const SUMMARY_PRIORITY: readonly StatRowKey[] = ["possession", "xg", "shotsTotal", "shotsOnTarget", "bigChancesMissed", "corners", "passAccuracy", "saves"];
/** Öncelikli satırın verisi yoksa boşluk sırayla bunlardan doldurulur (direkten dönen yalnızca toplam > 0 ise). */
export const SUMMARY_FALLBACKS: readonly StatRowKey[] = ["dangerousAttacks", "tacklesInterceptions", "passes", "woodwork", "fouls"];

/**
 * Özet sayfasının satırları (saf): öncelik listesinden verisi olanlar kendi sırasında, eksik kalan
 * yer sırayla yedeklerle 8'e tamamlanır; tamamlanamazsa olan kadar. Detay sayfası (03) burada
 * kullanılmayan satırları alır.
 */
export function summaryRowKeys(values: readonly StatRowValue[]): StatRowKey[] {
  const available = new Set(values.filter(isRowVisible).map((value) => value.key));
  const primary = SUMMARY_PRIORITY.filter((key) => available.has(key));
  const fallbacks = SUMMARY_FALLBACKS.filter((key) => available.has(key)).slice(0, Math.max(0, SUMMARY_SIZE - primary.length));
  return [...primary, ...fallbacks];
}

/** Etiketin büyük harfli hâli — süslü parantez içi olduğu gibi kalır: "Beklenen gol ({xG})" → "BEKLENEN GOL (xG)". */
export function upperLabel(label: string): string {
  return label
    .split(/(\{[^}]*\})/)
    .map((part) => (part.startsWith("{") && part.endsWith("}") ? part.slice(1, -1) : part.toLocaleUpperCase("tr-TR")))
    .join("");
}

/** Etiketin düz hâli (gönderi metni, uyarılar): "Beklenen gol ({xG})" → "Beklenen gol (xG)". */
export function plainLabel(label: string): string {
  return label.replace(/\{([^}]*)\}/g, "$1");
}

/** Özette xG satırı varsa panelin altına yazılan açıklama. */
export const XG_FOOTNOTE = "xG: Pozisyonların gole dönme ihtimallerinin toplamı. Yüksek xG = daha net fırsat.";

export const SECTION_LABELS: Record<StatSection, string> = {
  ATTACK: "Hücum",
  PASSING: "Pas",
  DEFENCE: "Savunma",
  DISCIPLINE: "Disiplin",
};

/**
 * Sağlayıcı değeri → sayı. "75%", "%75", "75", " 1,84 " ve sayı kabul edilir; boş, null ya da
 * sayıya çevrilemeyen değer `null` (satır gizlenir — sıfır sanılmaz).
 */
export function parseStatValue(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const cleaned = value.trim().replace(/%/g, "").replace(",", ".").trim();
  if (!cleaned || !/^-?\d+(\.\d+)?$/.test(cleaned)) return null;
  return Number(cleaned);
}

/** Kartta görünür mü: `hideWhenZero` satırlarda iki taraf da 0 ise gizlenir. */
export function isRowVisible(value: StatRowValue): boolean {
  return !(STAT_ROWS[value.key].hideWhenZero && value.home === 0 && value.away === 0);
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/**
 * Satır değeri → omurgadan dışa büyüyen iki çubuğun uzunluğu (0-1). `count` → payı (h / h+a),
 * `share100` → kendi yüzdesi, `rate` → kendi 0-100 değeri. count 0-0 → boş (gri, uzunluk 0).
 */
export function statBar(value: StatRowValue): StatBar {
  const def = STAT_ROWS[value.key];
  if (def.kind === "share100" || def.kind === "rate") {
    return { home: clamp01(value.home / 100), away: clamp01(value.away / 100), empty: false };
  }
  const total = value.home + value.away;
  if (total <= 0) return { home: 0, away: 0, empty: true };
  return { home: clamp01(value.home / total), away: clamp01(value.away / total), empty: false };
}

/** Ton: `higherIsBetter` satırda önde olan parlak, geride kalan soluk; eşitlikte ikisi parlak; nötr satır gümüş. */
export function statTones(value: StatRowValue): { home: StatTone; away: StatTone } {
  const def = STAT_ROWS[value.key];
  if (def.higherIsBetter === null) return { home: "neutral", away: "neutral" };
  if (value.home === value.away) return { home: "lead", away: "lead" };
  const homeLeads = def.higherIsBetter ? value.home > value.away : value.home < value.away;
  return homeLeads ? { home: "lead", away: "trail" } : { home: "trail", away: "lead" };
}

/** "%75" · "1,84" · "28" — Türkçe yazım (yüzde başta, ondalık virgül). */
export function formatStatValue(key: StatRowKey, value: number): string {
  const def = STAT_ROWS[key];
  const number = value.toLocaleString("tr-TR", { minimumFractionDigits: def.decimals, maximumFractionDigits: def.decimals });
  return def.percent ? `%${number}` : number;
}
