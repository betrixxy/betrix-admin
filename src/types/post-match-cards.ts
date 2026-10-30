import type { MatchDayFormatId } from "@/types/match-day";
import type { PeriodKind } from "@/types/prediction-scorecard";
import type { StudioJobStart } from "@/types/studio-job";

/**
 * Maç sonrası kural tabanlı kartların (Maç Analizi, Tahmin Karnesi) stüdyo sonuçları. İkisi de yarı otomatik:
 * admin tıklaması → arka plan işi → DRAFT `AiContent` (`MATCH_ANALYSIS` / `PREDICTION_SCORECARD`).
 */

export interface PostMatchSlide {
  url: string;
  /** "01 · Zaman çizelgesi" */
  label: string;
}

export interface PostMatchCardResult {
  id: string;
  format: MatchDayFormatId;
  /** Yayın sırasıyla görseller (Maç Analizi 01 + 02; karne tek kart). */
  slides: PostMatchSlide[];
  notes: string[];
}

export interface PostMatchCardActionState {
  error?: string;
  result?: PostMatchCardResult;
  job?: StudioJobStart;
}

/** "Sonuçları hesapla" (Tahmin Karnesi A) — yazılan / aynı kalan / henüz değerlendirilemeyen sonuç satırları. */
export interface SettleActionState {
  error?: string;
  summary?: { written: number; unchanged: number; pending: number };
  job?: StudioJobStart;
}

/** Tahmin Karnesi B girdisi (form). */
export interface PeriodScorecardRequest {
  kind: PeriodKind;
  /** Dönemi belirleyen gün (İstanbul, "2026-10-30"). */
  day: string;
  splitByModelVersion: boolean;
  format: MatchDayFormatId;
}
