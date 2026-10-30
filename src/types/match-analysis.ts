import type { NameOrigin } from "@/lib/dashboard/name-case";
import type { MatchResultFacts, MatchSide } from "./match-result";

/**
 * MAÇ ANALİZİ (menüde "Maç Sonrası Analiz Raporu", kartta "MAÇ ANALİZİ"; maç sonrası) — kanonik tipler.
 * KURAL TABANLI, yapay zekâ yok. 01 zaman çizelgesi: API-Football maç olayları (`/fixtures?id=` → events,
 * Maç Sonucu ile aynı yanıt — skor ve golcüler set kartlarıyla çelişemez). 02 devre devre: TEK kaynak —
 * API-Football devre istatistiği (`/fixtures/statistics?half=true`), yoksa Sportmonks dönem istatistiği
 * (`periods.statistics`); satır bazında karışım YOK, eksik satır düşer (asla 0 yazılmaz). Devre verisi
 * yoksa 02 düşer, sebep stüdyoda yazar; 01 tek başına üretilir.
 */

export const ANALYSIS_EVENT_KINDS = ["GOAL", "PENALTY_GOAL", "OWN_GOAL", "MISSED_PENALTY", "YELLOW", "SECOND_YELLOW", "RED", "SUBSTITUTION", "VAR"] as const;
export type AnalysisEventKind = (typeof ANALYSIS_EVENT_KINDS)[number];

/** Skoru değiştiren olaylar (KK dahil — golün yazıldığı tarafa). */
export const SCORING_KINDS: readonly AnalysisEventKind[] = ["GOAL", "PENALTY_GOAL", "OWN_GOAL"];
/** Takımı bir kişi eksilten olaylar. */
export const SENDING_OFF_KINDS: readonly AnalysisEventKind[] = ["SECOND_YELLOW", "RED"];

export interface SidePair {
  home: number;
  away: number;
}

export interface AnalysisPerson {
  playerId: number | null;
  /** Sağlayıcı adı ("V. Osimhen"); kart adı `match-analysis/names.ts` ile yazılır. */
  name: string;
  /** Büyük harf kökeni (adın harfi → uyruk); çözülmediyse yok → takımın kişi kökeni. */
  origin?: NameOrigin | null;
}

/**
 * Kırılma anı (kural tabanlı, `match-analysis/moments.ts`), öncelik sırasıyla: KAZANDIRAN GOL (galibi belirleyen
 * gol) > KIRMIZI + GOL (sonrasında sayıca üstün takımın gol attığı kırmızı kart; vurgu kartta) > EŞİTLEYEN GOL
 * (geriden gelip eşitleyen) > İLK GOL. Bir olaya tek etiket; kartta en fazla 2 an.
 */
export const BREAK_MOMENT_KINDS = ["DECISIVE_GOAL", "RED_THEN_GOAL", "EQUALISER", "FIRST_GOAL"] as const;
export type BreakMomentKind = (typeof BREAK_MOMENT_KINDS)[number];

export interface BreakMoment {
  kind: BreakMomentKind;
  /** Kartta yazan kısa etiket (≤ 16 karakter): "KAZANDIRAN GOL", "KIRMIZI + GOL", "EŞİTLEYEN GOL", "İLK GOL". */
  label: string;
}

export interface AnalysisEvent {
  kind: AnalysisEventKind;
  /** Olayın yazıldığı taraf — KK'de golün yazıldığı (kazanan) taraf, oyuncu rakipten. */
  side: MatchSide;
  elapsed: number;
  /** Uzatma dakikası ("45+2'" → 2); yoksa null. */
  extra: number | null;
  /** "45+2'", "90+5'", "12'" */
  minuteLabel: string;
  /** Golcü / kart gören / değişiklikte ÇIKAN / VAR olayının oyuncusu; bilinmiyorsa null. */
  player: AnalysisPerson | null;
  /** Değişiklikte GİREN oyuncu; diğer olaylarda null. */
  related: AnalysisPerson | null;
  /** VAR kararının kısa Türkçe etiketi ("Gol iptal"); bilinmeyen karar "VAR". Diğer olaylarda null. */
  varLabel: string | null;
  /** Gol olaylarında golden SONRAKİ skor; diğerlerinde null. */
  score: SidePair | null;
  breakMoment: BreakMoment | null;
}

/** 02'nin satırları (sırasıyla). */
export const HALF_STAT_KEYS = ["possession", "shotsTotal", "shotsOnTarget", "xg", "corners"] as const;
export type HalfStatKey = (typeof HALF_STAT_KEYS)[number];

export type HalfStatsSource = "API_FOOTBALL" | "SPORTMONKS";

/** Bir satır: iki yarıda da iki takımın değeri okunmuşsa vardır (biri eksikse satır yok). */
export interface HalfRow {
  key: HalfStatKey;
  first: SidePair;
  second: SidePair;
}

/** Tek kaynaktan devre istatistiği — satırların HEPSİ `source`'tan. */
export interface HalfStats {
  source: HalfStatsSource;
  rows: HalfRow[];
}

export type HalvesOutcome = { available: true; stats: HalfStats } | { available: false; reason: string };

export const ANALYSIS_FACT_KINDS = [
  "RED_THEN_CONCEDED",
  "RED_THEN_SCORED",
  "COMEBACK",
  "LATE_DECIDER",
  "SHOTS_MULTIPLIED",
  "NO_SHOTS_FIRST_HALF",
  "NO_SHOT_ON_TARGET_HALF",
  "EARLY_GOALS",
  "ONE_HALF_GOALS",
  "POSSESSION_SWING",
  "XG_SWING",
  "SHOTS_BOTH_HALVES",
  "HALF_SCORES",
] as const;
export type AnalysisFactKind = (typeof ANALYSIS_FACT_KINDS)[number];

/** Kural tabanlı olgu — yorum/sıfat yok, yalnızca doğru ifade (`match-analysis/facts.ts`). */
export interface AnalysisFact {
  kind: AnalysisFactKind;
  text: string;
}

/** Bitmiş maçın analiz verisi — üretim anında `statsSnapshot`'a yazılır. */
export interface MatchAnalysisFacts {
  match: MatchResultFacts;
  /** Dakikaya göre sıralı (uzatma dakikası doğru yerde), aynı dakikada sağlayıcı sırası korunur. */
  events: AnalysisEvent[];
  /** Olaylardan çıkan devre arası skoru (45+ dahil ilk yarı golleri). */
  halftime: SidePair;
  /** Olaylardan sayılan skor resmi skorla tutuyor mu — tutmuyorsa kırılma anı ve skor etiketi yazılmaz. */
  scoreConsistent: boolean;
  /** Eksenin sonu: 90 (normal süre) ya da 120 (uzatmalar oynandıysa). */
  axisEnd: 90 | 120;
  halves: HalvesOutcome;
  /** En fazla 3 olgu, öncelik sırasıyla (02'nin altında). */
  facts: AnalysisFact[];
  /** Stüdyoda gösterilecek uyarılar (skor tutarsızlığı vb.). */
  warnings: string[];
}

/* ---------- Kart alanları (çizim girdisi, büyük harfli) ---------- */

export interface AnalysisCardBase {
  accentHex: string;
  homeHex: string;
  awayHex: string;
  /** "01 · ZAMAN ÇİZELGESİ"; tek başına paylaşımda da sayfa sırası yazılır. */
  pageLabel: string | null;
  dateLabel: string;
  title: string;
  homeTeam: string;
  awayTeam: string;
  homeGoals: number;
  awayGoals: number;
  homeLogo: string | null;
  awayLogo: string | null;
  competitionLabel: string;
  roundLabel: string;
  brandLogo: string;
  footnote: string;
}

/** Zaman çizelgesinin bir satırı (değişiklikler aynı takım + aynı dakikada birleşir). */
export interface TimelineRowCard {
  side: MatchSide;
  kind: AnalysisEventKind;
  minuteLabel: string;
  /** Eksendeki konum için ham dakika. */
  elapsed: number;
  extra: number | null;
  /** "V. OSIMHEN", "2 DEĞİŞİKLİK", "VAR · GOL İPTAL" */
  text: string;
  /** İkincil metin: değişiklikte çıkan oyuncu ya da birleşik satırda girenler; yoksa null. */
  detail: string | null;
  /** "(P)", "(KK)"; yoksa null. */
  mark: string | null;
  /** Golde golden sonraki skor ("0-1"); yoksa null. */
  scoreLabel: string | null;
  breakLabel: string | null;
}

/** Ayraç: devre arası ("İY 0-2"), normal süre sonu (uzatmalı maçta "90' 1-1") ve maç sonu ("MS 0-4"). */
export interface TimelineDivider {
  /** Bu satır dizininden ÖNCE çizilir (`rows.length` = en sonda). */
  beforeRow: number;
  label: string;
}

export interface TimelineCard extends AnalysisCardBase {
  rows: TimelineRowCard[];
  dividers: TimelineDivider[];
  axisEnd: 90 | 120;
}

export interface HalvesRowCard {
  key: HalfStatKey;
  label: string;
  first: { home: string; away: string; homeShare: number };
  second: { home: string; away: string; homeShare: number };
}

export interface HalvesCard extends AnalysisCardBase {
  rows: HalvesRowCard[];
  facts: string[];
  firstLabel: string;
  secondLabel: string;
}
