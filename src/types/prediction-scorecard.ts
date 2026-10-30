import type { TeamOrigin } from "@/lib/dashboard/name-case";
import type { ScenarioId, ScenarioOutcome } from "@/types/prediction";

/**
 * Tahmin Karnesi (bkz. CLAUDE.md 1.10). Kaynak yalnızca `PredictionRecord` (onaylanmış tahmin, değiştirilemez; aynı maç + senaryoda yalnızca ilk onay); tuttu/tutmadı
 * ayrı tabloda (`PredictionOutcome`), değerlendirici `lib/prediction/settle.ts`. A = maç karnesi (bir maçın
 * BÜTÜN kayıtları), B = dönem karnesi (hafta / ay / sezon, dönemin BÜTÜN kayıtları). Seçme yolu yok.
 */

export const OUTCOME_STATUSES = ["HIT", "MISS", "VOID"] as const;
export type OutcomeStatus = (typeof OUTCOME_STATUSES)[number];

/** Sonucu sayılan durum (karneye giren). VOID = sonuçlanmadı, karneye girmez. */
export type SettledStatus = Exclude<OutcomeStatus, "VOID">;

export interface Goals {
  home: number;
  away: number;
}

/** Değerlendirmenin okuduğu maç skoru (sağlayıcıdan bağımsız). */
export interface FixtureScore {
  /** Sağlayıcının kısa durum kodu: "FT", "AET", "PEN", "PST", "1H"… */
  statusShort: string;
  /** Normal süre (90 dk) skoru — uzatma ve penaltı dahil değil. */
  fulltime: Goals | null;
  halftime: Goals | null;
}

/** Değerlendirme: sonuçlandı (HIT/MISS), sonuçlanmadı (VOID) ya da henüz değerlendirilemez (PENDING). */
export type Settlement =
  | { kind: "SETTLED"; status: SettledStatus; basis: "FULLTIME" | "HALFTIME"; score: Goals }
  | { kind: "VOID"; status: "VOID"; reason: string }
  | { kind: "PENDING"; reason: string };

/** Karnenin okuduğu tahmin kaydı (PredictionRecord'un karneye giren alanları). */
export interface ScorecardRecord {
  id: string;
  fixtureId: string;
  scenarioId: ScenarioId;
  outcome: ScenarioOutcome;
  /** Seçilen sonucun olasılığı, 0–1. */
  probability: number;
  /** null = "poisson-v1". */
  modelVersion: string | null;
  recordedAt: string;
}

/**
 * B girdisi: kayıt + maçın başlama anı + o kaydın EN SON sonucu (`PredictionOutcome`, en yüksek revizyon);
 * sonuç henüz yoksa `null` (maç bitmedi — karneye girmez, "bekleyen" sayılır).
 */
export interface ScorecardEntry {
  record: ScorecardRecord;
  kickoffUtc: string;
  status: OutcomeStatus | null;
}

export const PERIOD_KINDS = ["WEEK", "MONTH", "SEASON"] as const;
export type PeriodKind = (typeof PERIOD_KINDS)[number];

export interface ScorecardPeriod {
  kind: PeriodKind;
  /** UTC başlangıç (dahil) ve bitiş (hariç) — İstanbul günleriyle. */
  start: string;
  end: string;
  /** "27.10 – 02.11.2026", "EKİM 2026", "2026/27 SEZONU" */
  label: string;
}

/** Ana sayı: n ≥ 10 → yüzde; n < 10 → "3 tahminde 2 tuttu" + "İLK TAHMİNLER". */
export type HitSummary =
  | { kind: "RATE"; total: number; hits: number; percent: number; text: string }
  | { kind: "SMALL_SAMPLE"; total: number; hits: number; text: string; badge: string };

export interface ScorecardBreakdownRow {
  scenarioId: ScenarioId;
  label: string;
  total: number;
  hits: number;
  /** "2/3" ya da "7/12 · %58" (n ≥ 10). */
  value: string;
}

export interface ScorecardVersionRow {
  modelVersion: string;
  label: string;
  summary: HitSummary;
}

/** A · maç karnesinin bir satırı. */
export interface MatchScorecardRow {
  recordId: string;
  scenarioId: ScenarioId;
  question: string;
  /** Modelin cevabı ("Galatasaray") ve yüzdesi ("%52"). */
  answer: string;
  percent: string;
  /** Gerçekleşen ("Galatasaray · 1–2"). */
  actual: string;
  status: SettledStatus;
}

export interface MatchScorecardData {
  fixtureId: string;
  rows: MatchScorecardRow[];
  summary: HitSummary;
  /** Aynı senaryonun SONRAKİ onayları — ilk onay kuralıyla karneye girmez (kayıt silinmez). */
  duplicates: number;
}

export interface PeriodScorecardData {
  period: ScorecardPeriod;
  summary: HitSummary;
  breakdown: ScorecardBreakdownRow[];
  /** Son N sonuç, eskiden yeniye. */
  strip: SettledStatus[];
  /** Model sürümüne göre ayrım (istenirse ve dönemde birden çok sürüm varsa). */
  versions: ScorecardVersionRow[] | null;
  /** Dönemde olup henüz sonuçlanmamış (maçı bitmemiş) kayıt sayısı — karneye girmez. */
  pending: number;
  /** Sonuçlanmadı (ertelendi / iptal) — karneye girmez. */
  voided: number;
  /** Dönemdeki tekrar onaylar (aynı maç + senaryo, ilk onaydan sonra) — karneye girmez. */
  duplicates: number;
}

export interface ScorecardError {
  code: "NO_RECORDS" | "NOT_SETTLED" | "VOID" | "FOREIGN_RECORD" | "TOO_MANY_ROWS";
  message: string;
}

export interface ScorecardTeam {
  id: number;
  /** Kart takım adı (`cardTeamName`), büyütülmemiş. */
  name: string;
  logoUrl: string | null;
  origin?: TeamOrigin;
}

/** Karnenin maç alanları — `api-football/fixture-score.ts::toScorecardMatch`. */
export interface ScorecardMatch {
  fixtureId: string;
  kickoffUtc: string;
  /** Lig kart adı (`competition-names.ts`). */
  competition: { id: number; name: string };
  roundLabel: string;
  home: ScorecardTeam;
  away: ScorecardTeam;
  score: FixtureScore;
}
