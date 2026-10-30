import { fullDate, clock } from "@/lib/format/dates";
import type { MatchSides } from "@/lib/prediction/catalog";
import { buildMatchScorecard, NO_MATCH_RECORDS } from "@/lib/prediction/scorecard";
import { probabilityText, scorecardAnswer, scorecardQuestion } from "@/lib/prediction/scorecard-labels";
import type { MatchScorecardData, OutcomeStatus, ScorecardMatch, ScorecardRecord } from "@/types/prediction-scorecard";
import type { Result } from "@/types/result";

/**
 * Tahmin Karnesi stüdyosu — maçın kayıt listesi (saf). Her kayıt görünür: sayılan ilk onay ve sayılmayan tekrar
 * onay ayrı yazılır (silinmez), kayıtlı son sonuç ya da "hesaplanmadı".
 */

export interface StudioRecordRow {
  id: string;
  question: string;
  /** "Model: Galatasaray · %52" */
  answer: string;
  /** "30.10.2026 14:05 onay" */
  approved: string;
  counted: boolean;
  /** "Tuttu", "Tutmadı", "Sonuçlanmadı", "Hesaplanmadı" */
  status: string;
}

const STATUS_TEXT: Record<OutcomeStatus, string> = { HIT: "Tuttu", MISS: "Tutmadı", VOID: "Sonuçlanmadı" };

export function studioRecordRows(entries: readonly { record: ScorecardRecord; latest: { status: OutcomeStatus } | null; duplicate: boolean }[], sides: MatchSides): StudioRecordRow[] {
  return entries.map(({ record, latest, duplicate }) => ({
    id: record.id,
    question: scorecardQuestion(record.outcome, sides),
    answer: `Model: ${scorecardAnswer(record.outcome, sides)} · ${probabilityText(record.probability)}`,
    approved: `${fullDate(record.recordedAt)} ${clock(record.recordedAt)} onay`,
    counted: !duplicate,
    status: latest ? STATUS_TEXT[latest.status] : "Hesaplanmadı",
  }));
}

/** Kartın hazır olup olmadığı (Maç Sonucu setindeki "Tahmin karnesini de ekle" de bunu okur): sebep ya da null. */
export function scorecardBlocker(entries: readonly { latest: { status: OutcomeStatus } | null; duplicate: boolean }[]): string | null {
  const counted = entries.filter((entry) => !entry.duplicate);
  if (counted.length === 0) return NO_MATCH_RECORDS;
  if (counted.some((entry) => !entry.latest)) return "Tahminlerin sonucu henüz hesaplanmadı — Tahmin Karnesi stüdyosunda \"Sonuçları hesapla\"ya basın.";
  if (counted.every((entry) => entry.latest?.status === "VOID")) return "Maç sonuçlanmadı (ertelendi / iptal) — tahminler karneye girmez.";
  return null;
}

/**
 * A verisi + kayıtlı sonuçlarla tutarlılık (saf): sayılan her satırın son sonucu yazılmış ve güncel skorla aynı
 * olmalı; değilse kart üretilmez — karne veritabanıyla çelişemez (önce "Sonuçları hesapla").
 */
export function matchScorecardFromRecords(match: ScorecardMatch, loaded: readonly { record: ScorecardRecord; latest: { status: OutcomeStatus } | null }[]): Result<MatchScorecardData, { code: string; message: string }> {
  const built = buildMatchScorecard({ fixtureId: match.fixtureId, sides: { home: match.home.name, away: match.away.name }, score: match.score, records: loaded.map((entry) => entry.record) });
  if (!built.ok) return built;
  const latest = new Map(loaded.map((entry) => [entry.record.id, entry.latest?.status ?? null]));
  const stale = built.data.rows.filter((row) => latest.get(row.recordId) !== row.status).length;
  if (stale > 0) return { ok: false, error: { code: "NOT_SETTLED_IN_DB", message: `${stale} tahminin sonucu henüz kaydedilmedi ya da güncel skordan farklı — önce "Sonuçları hesapla"ya basın. Tahmin Karnesi üretilmedi.` } };
  return built;
}
