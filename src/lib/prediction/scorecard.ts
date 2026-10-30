import type { MatchSides } from "@/lib/prediction/catalog";
import { inPeriod } from "@/lib/prediction/scorecard-period";
import { breakdownValue, hitSummary, probabilityText, scorecardActual, scorecardAnswer, scorecardQuestion, SCENARIO_KIND_LABELS, versionKey, versionLabel } from "@/lib/prediction/scorecard-labels";
import { settleOutcome } from "@/lib/prediction/settle";
import { SCENARIO_IDS } from "@/types/prediction";
import type { FixtureScore, MatchScorecardData, MatchScorecardRow, PeriodScorecardData, ScorecardEntry, ScorecardError, ScorecardPeriod, ScorecardRecord, SettledStatus } from "@/types/prediction-scorecard";
import type { Result } from "@/types/result";

/**
 * Tahmin Karnesi veri kurucuları (saf). SEÇME YOK: girdi bir maçın (A) ya da bütün yayınlanmış kayıtların (B)
 * TAMAMIDIR; fonksiyonların kayıt dışarıda bırakan bir parametresi yoktur, her kayıt ya karnede ya da
 * sebebiyle sayılır (bekleyen / sonuçlanmadı). Tutmayan kayıt düşürülemez (testle sabit:
 * `tests/unit/prediction-scorecard.test.ts`).
 *
 * "Yayınlanmış" (veri katmanı, aşama 2): `PredictionRecord` onayda yazılır (= onaylı) VE kaydın içeriği
 * Yayın Merkezi'nden paylaşılmış (`AiContent.status = PUBLISHED`, `publishedAt` dolu; yayın kapısı yalnızca
 * kickoff öncesine izin verir — `vitrinPublishCheck`). Kurucular bu kümeyi olduğu gibi alır.
 */

/** A'da en fazla bu kadar satır (6 senaryonun hepsi). Fazlası kartı taşırır: kart üretilmez, satır düşürülmez. */
export const MAX_MATCH_ROWS = 6;
/** B'deki ✅/❌ şeridinin uzunluğu (son N sonuç). */
export const STRIP_LENGTH = 10;

const fail = (code: ScorecardError["code"], message: string): { ok: false; error: ScorecardError } => ({ ok: false, error: { code, message } });

/** Kayıtların sabit sırası: onay anı, sonra senaryo kataloğu sırası, sonra kimlik. */
function byRecordOrder(a: ScorecardRecord, b: ScorecardRecord): number {
  return a.recordedAt.localeCompare(b.recordedAt) || SCENARIO_IDS.indexOf(a.scenarioId) - SCENARIO_IDS.indexOf(b.scenarioId) || a.id.localeCompare(b.id);
}

/**
 * A · maç karnesi: maçın BÜTÜN kayıtları (soru, modelin cevabı + yüzdesi, gerçekleşen, tuttu/tutmadı). Kayıt
 * yoksa, maç sonuçlanmadıysa (ertelendi/iptal) ya da henüz bitmediyse kart üretilmez — sebep yazılır.
 */
export function buildMatchScorecard(input: { fixtureId: string; sides: MatchSides; score: FixtureScore; records: readonly ScorecardRecord[] }): Result<MatchScorecardData, ScorecardError> {
  const { records } = input;
  if (records.length === 0) return fail("NO_RECORDS", "Bu maç için yayınlanmış tahmin kaydı yok — Tahmin Karnesi üretilmedi.");
  const foreign = records.find((record) => record.fixtureId !== input.fixtureId);
  if (foreign) return fail("FOREIGN_RECORD", `Başka maçın kaydı karışmış (${foreign.fixtureId}) — Tahmin Karnesi üretilmedi.`);
  if (records.length > MAX_MATCH_ROWS) return fail("TOO_MANY_ROWS", `Bu maçın ${records.length} kaydı var, kart en fazla ${MAX_MATCH_ROWS} satır taşır — kayıt düşürülmez, Tahmin Karnesi üretilmedi.`);
  const rows: MatchScorecardRow[] = [];
  for (const record of [...records].sort(byRecordOrder)) {
    const settlement = settleOutcome(record.outcome, input.score);
    if (settlement.kind === "VOID") return fail("VOID", `${settlement.reason} Tahmin Karnesi üretilmedi.`);
    if (settlement.kind === "PENDING") return fail("NOT_SETTLED", `${settlement.reason} Tahmin Karnesi üretilmedi.`);
    rows.push({
      recordId: record.id,
      scenarioId: record.scenarioId,
      question: scorecardQuestion(record.outcome, input.sides),
      answer: scorecardAnswer(record.outcome, input.sides),
      percent: probabilityText(record.probability),
      actual: scorecardActual(record.outcome, settlement.score, input.sides),
      status: settlement.status,
    });
  }
  const hits = rows.filter((row) => row.status === "HIT").length;
  return { ok: true, data: { fixtureId: input.fixtureId, rows, summary: hitSummary(rows.length, hits) } };
}

type Settled = ScorecardEntry & { status: SettledStatus };

function byKickoff(a: ScorecardEntry, b: ScorecardEntry): number {
  return a.kickoffUtc.localeCompare(b.kickoffUtc) || byRecordOrder(a.record, b.record);
}

/**
 * B · dönem karnesi: dönemdeki BÜTÜN kayıtlar (maçın başlama anına göre). Sonuçlanan (tuttu/tutmadı) karneye
 * girer; sonuçlanmayan (VOID) ve bekleyen ayrıca sayılır. `splitByModelVersion`: dönemde birden çok model
 * sürümü varsa sürüme göre ayrı satırlar (null = "poisson-v1"); tek sürümde ayrım yok.
 */
export function buildPeriodScorecard(input: { period: ScorecardPeriod; entries: readonly ScorecardEntry[]; splitByModelVersion: boolean }): Result<PeriodScorecardData, ScorecardError> {
  const inside = input.entries.filter((entry) => inPeriod(input.period, entry.kickoffUtc));
  const settled = inside.filter((entry): entry is Settled => entry.status === "HIT" || entry.status === "MISS").sort(byKickoff);
  const voided = inside.filter((entry) => entry.status === "VOID").length;
  const pending = inside.filter((entry) => entry.status === null).length;
  if (settled.length === 0) {
    const extra = pending + voided > 0 ? ` (${pending} bekleyen, ${voided} sonuçlanmadı)` : "";
    return fail("NO_RECORDS", `${input.period.label}: sonuçlanmış yayınlanmış tahmin yok${extra} — Tahmin Karnesi üretilmedi.`);
  }
  const count = (list: readonly Settled[]) => ({ total: list.length, hits: list.filter((entry) => entry.status === "HIT").length });
  const breakdown = SCENARIO_IDS.flatMap((scenarioId) => {
    const { total, hits } = count(settled.filter((entry) => entry.record.scenarioId === scenarioId));
    return total > 0 ? [{ scenarioId, label: SCENARIO_KIND_LABELS[scenarioId], total, hits, value: breakdownValue(total, hits) }] : [];
  });
  const keys = [...new Set(settled.map((entry) => versionKey(entry.record.modelVersion)))].sort();
  const versions =
    input.splitByModelVersion && keys.length > 1
      ? keys.map((key) => {
          const { total, hits } = count(settled.filter((entry) => versionKey(entry.record.modelVersion) === key));
          return { modelVersion: key, label: versionLabel(key), summary: hitSummary(total, hits) };
        })
      : null;
  const { total, hits } = count(settled);
  return {
    ok: true,
    data: { period: input.period, summary: hitSummary(total, hits), breakdown, strip: settled.slice(-STRIP_LENGTH).map((entry) => entry.status), versions, pending, voided },
  };
}
