import type { MatchDayFormatId } from "./match-day";
import type { SetCard } from "./checkmatch-set";
import type { Competition, MatchOutcome, ResultTeam } from "./match-result";

/**
 * MAÇ İSTATİSTİKLERİ kartı (`AiContent.contentType = "MATCH_STATS"`, maç sonrası) — kanonik tipler.
 * Maç Sonucu altyapısını (bitmiş maç doğrulaması, formatlar, Satori + sharp katmanları) paylaşır.
 * Satır tanımları `lib/dashboard/match-stats-rows.ts`'tedir; burada yalnızca şekil yaşar.
 */

export const STAT_ROW_KEYS = [
  "possession",
  "xg",
  "shotsTotal",
  "shotsOnTarget",
  "shotsOffTarget",
  "shotsBlocked",
  "shotsInsideBox",
  "bigChancesMissed",
  "dangerousAttacks",
  "woodwork",
  "corners",
  "offsides",
  "fouls",
  "yellowCards",
  "redCards",
  "tacklesInterceptions",
  "saves",
  "passes",
  "passAccuracy",
] as const;
export type StatRowKey = (typeof STAT_ROW_KEYS)[number];

/**
 * Çubuk türü: `share100` tek bölünmüş çubuk (toplam 100) · `count` pay oranıyla bölünmüş çubuk
 * (0-0 → gri, ortada) · `rate` her taraf kendi 0-100 çubuğu, merkezden dışa.
 */
export type StatRowKind = "share100" | "count" | "rate";

export const STAT_SECTIONS = ["ATTACK", "PASSING", "DEFENCE", "DISCIPLINE"] as const;
export type StatSection = (typeof STAT_SECTIONS)[number];

export interface StatRowDef {
  key: StatRowKey;
  /**
   * Kartta yazan Türkçe etiket ("Top hakimiyeti"). Süslü parantez içi büyük harf dönüşümünden
   * muaftır ve olduğu gibi yazılır: "Beklenen gol ({xG})" → "BEKLENEN GOL (xG)" (bkz. `upperLabel`).
   */
  label: string;
  kind: StatRowKind;
  /** true: önde olan taraf parlak (takım rengi), diğeri soluk · null: nötr (faul/kart/ofsayt). */
  higherIsBetter: boolean | null;
  section: StatSection;
  /** İki taraf da 0 ise satır gizlenir (kırmızı kart, direkten dönen). */
  hideWhenZero: boolean;
  /** Ondalık basamak (xG: 2). */
  decimals: number;
  /** Değer yüzde olarak yazılır ("%75"). */
  percent: boolean;
}

export type StatSource = "api-football" | "sportmonks";

/** Bir satırın iki tarafının gerçek değeri — iki taraftan biri bile yoksa satır facts'e girmez. */
export interface StatRowValue {
  key: StatRowKey;
  home: number;
  away: number;
  source: StatSource;
}

/** Set kartıyla aynı takım verisi (golcüler dahil) — kaynak `toMatchResultFacts`. */
export type StatsTeam = ResultTeam;

/** Bitmiş maçın istatistikleri — üretim anında `statsSnapshot`'a yazılır. */
export interface MatchStatsFacts {
  fixtureId: number;
  /** ISO 8601, UTC */
  kickoffUtc: string;
  statusShort: "FT" | "AET" | "PEN";
  competition: Competition;
  roundLabel: string;
  home: StatsTeam;
  away: StatsTeam;
  outcome: MatchOutcome;
  penaltyScore: string | null;
  /** Yalnızca iki tarafı da bilinen satırlar, `STAT_ROW_KEYS` sırasıyla. */
  rows: StatRowValue[];
  /** Sportmonks maçı eşleşti mi (eşleşmezse yalnızca API-Football satırları). */
  sportmonksMatched: boolean;
  /** İki kaynağın çeliştiği değerler (kart sayıları) — stüdyoda uyarı olarak gösterilir, sessizce seçilmez. */
  warnings: string[];
}

export const MATCH_STATS_LAYOUTS = ["SINGLE", "CAROUSEL"] as const;
export type MatchStatsLayout = (typeof MATCH_STATS_LAYOUTS)[number];

export type MatchStatsPage = "SUMMARY" | "DETAIL";

/**
 * Omurgadan dışa büyüyen iki çubuğun uzunluğu (0-1, yarım genişliğe göre): `count` → payı,
 * `share100` → kendi yüzdesi, `rate` → kendi 0-100 değeri. `empty`: count 0-0 (gri).
 */
export interface StatBar {
  home: number;
  away: number;
  empty: boolean;
}

/** Çubuk tonu: `lead` takım rengi tam parlak · `trail` %45 opak · `neutral` gümüş. */
export type StatTone = "lead" | "trail" | "neutral";

/** Şablona giden, biçimlenmiş satır. */
export interface StatCardRow {
  key: StatRowKey;
  label: string;
  homeText: string;
  awayText: string;
  bar: StatBar;
  homeTone: StatTone;
  awayTone: StatTone;
}

export interface StatCardSection {
  /** "HÜCUM"; Özet sayfasında null (başlıksız tek liste). */
  title: string | null;
  rows: StatCardRow[];
}

/** Şablona giden kart — set alanları (skor şeridi, golcüler, etiket, künye) + istatistik alanları. */
export interface MatchStatsCard extends SetCard {
  page: MatchStatsPage;
  /** Kurala dayalı öne çıkan satır (LLM yok); kural tutmazsa null. */
  highlight: string | null;
  /** Takım renkleri yalnızca istatistik çubuklarında kullanılır. */
  homeHex: string;
  awayHex: string;
  sections: StatCardSection[];
  /** Özette xG satırı varsa panelin altındaki açıklama; yoksa null. */
  footnote: string | null;
}

/** Stüdyo üretim sonucu (tek başına 02). */
export interface MatchStatsGenerationResult {
  id: string;
  resultImageUrl: string;
  format: MatchDayFormatId;
  /** Kaynak çelişkisi, zemin kaynağı, Sportmonks eşleşmesi… */
  notes: string[];
}

export interface MatchStatsActionState {
  error?: string;
  result?: MatchStatsGenerationResult;
}
