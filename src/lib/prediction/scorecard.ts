import type { MatchSides } from "@/lib/prediction/catalog";
import { inPeriod } from "@/lib/prediction/scorecard-period";
import { breakdownValue, hitSummary, probabilityText, scorecardActual, scorecardAnswer, scorecardQuestion, SCENARIO_KIND_LABELS, versionKey, versionLabel } from "@/lib/prediction/scorecard-labels";
import { settleOutcome } from "@/lib/prediction/settle";
import { SCENARIO_IDS } from "@/types/prediction";
import type { FixtureScore, MatchScorecardData, MatchScorecardRow, PeriodScorecardData, ScorecardEntry, ScorecardError, ScorecardPeriod, ScorecardRecord, SettledStatus } from "@/types/prediction-scorecard";
import type { Result } from "@/types/result";

/**
 * Tahmin Karnesi veri kurucuları (saf). SEÇME YOK: girdi bir maçın (A) ya da dönemin (B) BÜTÜN kayıtlarıdır;
 * fonksiyonların kayıt dışarıda bırakan bir parametresi yoktur, her kayıt ya karnede ya da sebebiyle sayılır
 * (bekleyen / sonuçlanmadı / tekrar onay). Tutmayan kayıt düşürülemez (testle sabit:
 * `tests/unit/prediction-scorecard.test.ts`).
 *
 * SAYILAN TAHMİN (kurucu kararı 2026-10-30) = ONAYLANMIŞ tahmin: her `PredictionRecord` (vitrin onayında yazılır;
 * yayınlanmış olması gerekmez). Aynı maç + senaryo için YALNIZCA İLK ONAY sayılır (`countedRecords`: en erken
 * `recordedAt`, eşitlikte kimlik); sonraki onaylar karneye girmez ama SİLİNMEZ (tablo değiştirilemez) — yalnızca
 * "tekrar onay" olarak sayılır. Kural sonuçtan bağımsızdır: hangi kaydın sayılacağı tuttu/tutmadı bilinmeden,
 * yalnızca zamandan seçilir; tutmayan ilk onay, sonradan tutan bir onayla değiştirilemez.
 */

/** Maç A için kayıt yok — stüdyo da bu metni gösterir (kart üretilmez). */
export const NO_MATCH_RECORDS = "Bu maç için onaylanmış tahmin yok — kart üretilmez.";

/** A'da en fazla bu kadar satır (6 senaryonun hepsi). Fazlası kartı taşırır: kart üretilmez, satır düşürülmez. */
export const MAX_MATCH_ROWS = 6;
/** B'deki ✅/❌ şeridinin uzunluğu (son N sonuç). */
export const STRIP_LENGTH = 10;

const fail = (code: ScorecardError["code"], message: string): { ok: false; error: ScorecardError } => ({ ok: false, error: { code, message } });

/**
 * İlk onay kuralı (saf): aynı (maç, senaryo) çiftinden yalnızca en erken onaylanan kayıt sayılır (eşitlikte
 * kimlik). `duplicates` = sayılmayan sonraki onaylar (karneye girmez, silinmez). Sonuca (HIT/MISS) bakmaz.
 */
export function countedRecords<T extends Pick<ScorecardRecord, "id" | "fixtureId" | "scenarioId" | "recordedAt">>(records: readonly T[]): { counted: T[]; duplicates: T[] } {
  const first = new Map<string, T>();
  for (const record of records) {
    const key = `${record.fixtureId}|${record.scenarioId}`;
    const current = first.get(key);
    if (!current || record.recordedAt.localeCompare(current.recordedAt) < 0 || (record.recordedAt === current.recordedAt && record.id.localeCompare(current.id) < 0)) first.set(key, record);
  }
  const keep = new Set(first.values());
  return { counted: records.filter((record) => keep.has(record)), duplicates: records.filter((record) => !keep.has(record)) };
}

/** B girdisinde ilk onay kuralı: kaydın kendisine göre (dönem filtresinden ÖNCE — tekrar başka döneme kaçamaz). */
function countedEntries(entries: readonly ScorecardEntry[]): { counted: ScorecardEntry[] } {
  const keep = new Set(countedRecords(entries.map((entry) => entry.record)).counted);
  return { counted: entries.filter((entry) => keep.has(entry.record)) };
}

/** Kayıtların sabit sırası: onay anı, sonra senaryo kataloğu sırası, sonra kimlik. */
function byRecordOrder(a: ScorecardRecord, b: ScorecardRecord): number {
  return a.recordedAt.localeCompare(b.recordedAt) || SCENARIO_IDS.indexOf(a.scenarioId) - SCENARIO_IDS.indexOf(b.scenarioId) || a.id.localeCompare(b.id);
}

/**
 * A · maç karnesi: maçın BÜTÜN kayıtları (soru, modelin cevabı + yüzdesi, gerçekleşen, tuttu/tutmadı). Kayıt
 * yoksa, maç sonuçlanmadıysa (ertelendi/iptal) ya da henüz bitmediyse kart üretilmez — sebep yazılır.
 */
export function buildMatchScorecard(input: { fixtureId: string; sides: MatchSides; score: FixtureScore; records: readonly ScorecardRecord[] }): Result<MatchScorecardData, ScorecardError> {
  if (input.records.length === 0) return fail("NO_RECORDS", NO_MATCH_RECORDS);
  const foreign = input.records.find((record) => record.fixtureId !== input.fixtureId);
  if (foreign) return fail("FOREIGN_RECORD", `Başka maçın kaydı karışmış (${foreign.fixtureId}) — Tahmin Karnesi üretilmedi.`);
  const { counted: records, duplicates } = countedRecords(input.records);
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
  return { ok: true, data: { fixtureId: input.fixtureId, rows, summary: hitSummary(rows.length, hits), duplicates: duplicates.length } };
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
  const inside = countedEntries(input.entries).counted.filter((entry) => inPeriod(input.period, entry.kickoffUtc));
  const duplicates = input.entries.filter((entry) => inPeriod(input.period, entry.kickoffUtc)).length - inside.length;
  const settled = inside.filter((entry): entry is Settled => entry.status === "HIT" || entry.status === "MISS").sort(byKickoff);
  const voided = inside.filter((entry) => entry.status === "VOID").length;
  const pending = inside.filter((entry) => entry.status === null).length;
  if (settled.length === 0) {
    const extra = pending + voided > 0 ? ` (${pending} bekleyen, ${voided} sonuçlanmadı)` : "";
    return fail("NO_RECORDS", `${input.period.label}: sonuçlanmış onaylı tahmin yok${extra} — Tahmin Karnesi üretilmedi.`);
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
    data: { period: input.period, summary: hitSummary(total, hits), breakdown, strip: settled.slice(-STRIP_LENGTH).map((entry) => entry.status), versions, pending, voided, duplicates },
  };
}
