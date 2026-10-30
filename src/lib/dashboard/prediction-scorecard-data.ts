import { z } from "zod";
import { countedRecords } from "@/lib/prediction/scorecard";
import { outcomeRowFor } from "@/lib/prediction/settle";
import { outcomeSchema } from "@/lib/prediction/record";
import { prisma } from "@/lib/prisma";
import { SCENARIO_IDS } from "@/types/prediction";
import type { OutcomeStatus, ScorecardEntry, ScorecardMatch, ScorecardPeriod, ScorecardRecord } from "@/types/prediction-scorecard";

/**
 * Tahmin Karnesi veri katmanı (Prisma). Okuma: maçın / dönemin BÜTÜN `PredictionRecord`'ları (onaylanmış tahmin)
 * + her kaydın EN SON sonucu (`PredictionOutcome`, en yüksek revizyon). Yazma: YALNIZCA `writeFixtureOutcomes` —
 * admin "Sonuçları hesapla" tıklamasıyla (zamanlayıcı yok, CLAUDE.md 1.10), yalnızca EKLEME (tablo UPDATE /
 * DELETE'i trigger'la reddeder; düzeltme = yeni revizyon). Tekrar onaylar da sonuç alır (veri eksiksiz kalsın);
 * karne onları ilk onay kuralıyla dışarıda bırakır (`countedRecords`).
 */

const scenarioSchema = z.enum(SCENARIO_IDS);
const kickoffSchema = z.object({ kickoffUtc: z.string() });

export interface StoredOutcome {
  revision: number;
  status: OutcomeStatus;
  fixtureStatus: string;
  homeGoals: number | null;
  awayGoals: number | null;
  htHomeGoals: number | null;
  htAwayGoals: number | null;
  evaluatorVersion: string;
}

export interface LoadedRecord {
  record: ScorecardRecord;
  latest: StoredOutcome | null;
  /** İlk onay kuralıyla sayılmayan tekrar onay. */
  duplicate: boolean;
}

const recordSelect = {
  id: true,
  aiContentId: true,
  fixtureId: true,
  scenarioId: true,
  outcome: true,
  probability: true,
  modelVersion: true,
  recordedAt: true,
  outcomes: { orderBy: { revision: "desc" }, take: 1, select: { revision: true, status: true, fixtureStatus: true, homeGoals: true, awayGoals: true, htHomeGoals: true, htAwayGoals: true, evaluatorVersion: true, kickoffAt: true } },
} as const;

type RecordRow = Awaited<ReturnType<typeof findRecords>>[number];

function findRecords(where: { fixtureId?: string; recordedAt?: { gte: Date; lt: Date } }) {
  return prisma.predictionRecord.findMany({ where, orderBy: [{ recordedAt: "asc" }, { id: "asc" }], select: recordSelect });
}

/** Satır → karne kaydı; bozuk satır (bilinmeyen senaryo/sonuç) null — sayılmaz, günlüğe düşer. */
function toLoaded(row: RecordRow): { record: ScorecardRecord; latest: (StoredOutcome & { kickoffAt: Date }) | null } | null {
  const scenario = scenarioSchema.safeParse(row.scenarioId);
  const outcome = outcomeSchema.safeParse(row.outcome);
  if (!scenario.success || !outcome.success) {
    console.error(`[karne] kayıt okunamadı (${row.id}) — senaryo/sonuç şemaya uymuyor`);
    return null;
  }
  const record: ScorecardRecord = { id: row.id, fixtureId: row.fixtureId, scenarioId: scenario.data, outcome: outcome.data, probability: Number(row.probability), modelVersion: row.modelVersion, recordedAt: row.recordedAt.toISOString() };
  return { record, latest: row.outcomes[0] ?? null };
}

/** A · maçın bütün kayıtları (tekrar onaylar işaretli) + son sonuçları. */
export async function loadFixtureRecords(fixtureId: string): Promise<LoadedRecord[]> {
  const loaded = (await findRecords({ fixtureId })).map(toLoaded).filter((entry) => entry !== null);
  const counted = new Set(countedRecords(loaded.map((entry) => entry.record)).counted);
  return loaded.map((entry) => ({ record: entry.record, latest: entry.latest, duplicate: !counted.has(entry.record) }));
}

/** Kayıtların onaylandığı en erken an — maçtan en fazla bu kadar gün önce (Vitrin: bugünden itibaren 7 gün). */
const RECORD_LEAD_DAYS = 14;

/**
 * B · dönemin girdisi: başlama anı dönemde olan bütün kayıtlar (karne süzer ve tekrarları ayıklar). Başlama anı
 * kaydın sonucundan (`kickoffAt`); sonucu henüz yoksa Vitrin kaydının anlık görüntüsünden (`kickoffUtc`), o da
 * yoksa tahminin hesaplandığı an — yalnızca "bekleyen" sayısını etkiler.
 */
export async function loadPeriodEntries(period: Pick<ScorecardPeriod, "start" | "end">): Promise<ScorecardEntry[]> {
  const start = new Date(new Date(period.start).getTime() - RECORD_LEAD_DAYS * 86_400_000);
  const rows = await findRecords({ recordedAt: { gte: start, lt: new Date(period.end) } });
  const pendingContent = [...new Set(rows.filter((row) => row.outcomes.length === 0).map((row) => row.aiContentId))];
  const contents = pendingContent.length > 0 ? await prisma.aiContent.findMany({ where: { id: { in: pendingContent } }, select: { id: true, renderOptions: true } }) : [];
  const kickoffs = new Map(contents.flatMap((content) => {
    const parsed = kickoffSchema.safeParse(content.renderOptions);
    return parsed.success ? [[content.id, parsed.data.kickoffUtc] as const] : [];
  }));
  return rows.flatMap((row) => {
    const loaded = toLoaded(row);
    if (!loaded) return [];
    const kickoffUtc = loaded.latest?.kickoffAt.toISOString() ?? kickoffs.get(row.aiContentId) ?? row.recordedAt.toISOString();
    return [{ record: loaded.record, kickoffUtc, status: loaded.latest?.status ?? null }];
  });
}

export interface SettleSummary {
  /** Yeni yazılan sonuç satırı (ilk değerlendirme ya da düzeltme revizyonu). */
  written: number;
  /** Son revizyonla aynı — yazılmadı. */
  unchanged: number;
  /** Maç henüz değerlendirilemez (bitmedi / skor yok) — yazılmadı. */
  pending: number;
}

/**
 * "Sonuçları hesapla" (admin tıklaması): maçın bütün kayıtlarını skorla değerlendirir, değişen ya da ilk sonucu
 * EKLER (tek transaction; aynı revizyon iki kez yazılamaz — `@@unique([predictionRecordId, revision])`).
 */
export async function writeFixtureOutcomes(match: Pick<ScorecardMatch, "fixtureId" | "kickoffUtc" | "score">): Promise<SettleSummary> {
  const rows = (await findRecords({ fixtureId: match.fixtureId })).map(toLoaded).filter((entry) => entry !== null);
  const fixture = { ...match.score, kickoffUtc: match.kickoffUtc };
  const summary: SettleSummary = { written: 0, unchanged: 0, pending: 0 };
  const inserts = rows.flatMap(({ record, latest }) => {
    const row = outcomeRowFor(record, fixture, latest);
    if (row) return [row];
    if (latest) summary.unchanged += 1;
    else summary.pending += 1;
    return [];
  });
  if (inserts.length > 0) await prisma.$transaction(inserts.map((data) => prisma.predictionOutcome.create({ data })));
  summary.written = inserts.length;
  return summary;
}
