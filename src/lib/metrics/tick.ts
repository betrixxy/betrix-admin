import { backfillInstagram, collectAccountDaily, collectAudience } from "@/lib/metrics/account-daily";
import {
  ACCOUNT_DAILY_AT,
  applyOutcome,
  AUDIENCE_WEEKLY_AT,
  nextIstanbulMonday,
  nextIstanbulTime,
  previousIstanbulDay,
} from "@/lib/metrics/job-policy";
import { claimDueJobs, ensureJobs, finishJob, releaseJobs, type ClaimedJob } from "@/lib/metrics/jobs";
import { collectPostMetrics } from "@/lib/metrics/post-metrics";
import { checkpointLabelAt, nextCheckpointAt } from "@/lib/metrics/schedule";
import { loadTargets } from "@/lib/metrics/snapshot-store";
import type { PostCollectOutcome } from "@/types/post-metrics";

/**
 * Saatlik tetikleme (`/api/internal/metrics/tick`): işleri oluşturur, vadesi gelenleri alır ve çalıştırır.
 * Yalnızca OKUMA yapan işler çalışır — paylaşım/üretim çağrısı yoktur (bkz. CLAUDE.md 1.10).
 */

const BATCH = 100;
/** Bir tetiklemenin çalışma bütçesi — scheduler'ın istek zaman aşımının altında kalır. */
const TIME_BUDGET_MS = 45_000;

export interface TickReport {
  processed: number;
  ok: number;
  deferred: number;
  failed: number;
  blocked: number;
  released: number;
}

function tally(report: TickReport, outcome: PostCollectOutcome): void {
  report.processed += 1;
  if (outcome.status === "OK") report.ok += 1;
  else if (outcome.status === "DEFERRED") report.deferred += 1;
  else if (outcome.status === "BLOCKED") report.blocked += 1;
  else if (outcome.status === "ERROR") report.failed += 1;
}

async function runPostJobs(jobs: readonly ClaimedJob[], now: Date, report: TickReport): Promise<void> {
  if (jobs.length === 0) return;
  const targets = await loadTargets({ id: { in: jobs.map((job) => job.target) } });
  const byId = new Map(targets.map((target) => [target.id, target]));
  const outcomes = await collectPostMetrics(targets, { trigger: "SCHEDULED", now, checkpointOf: (target) => checkpointLabelAt(target.publishedAt, target.mediaType, now) });
  for (const job of jobs) {
    const target = byId.get(job.target);
    const outcome: PostCollectOutcome = target ? (outcomes.get(target.id) ?? { status: "ERROR", message: "Sonuç alınamadı." }) : { status: "GONE", message: "Gönderi artık yok ya da platform kimliği yok." };
    const next = target ? nextCheckpointAt(target.publishedAt, target.mediaType, now) : null;
    await finishJob(job.id, applyOutcome(job.attempts, outcome, next, now), now);
    tally(report, outcome);
  }
}

async function runAccountJob(job: ClaimedJob, now: Date): Promise<{ outcome: PostCollectOutcome; next: Date | null }> {
  const platform = job.target === "X" || job.target === "META_INSTAGRAM" ? job.target : null;
  if (!platform) return { outcome: { status: "GONE", message: "Desteklenmeyen platform." }, next: null };
  switch (job.kind) {
    case "ACCOUNT_DAILY":
      return { outcome: await collectAccountDaily(platform, previousIstanbulDay(now), now), next: nextIstanbulTime(now, ACCOUNT_DAILY_AT.hour, ACCOUNT_DAILY_AT.minute) };
    case "AUDIENCE_WEEKLY":
      return { outcome: platform === "META_INSTAGRAM" ? await collectAudience(now) : { status: "GONE", message: "X demografi vermez." }, next: nextIstanbulMonday(now, AUDIENCE_WEEKLY_AT.hour, AUDIENCE_WEEKLY_AT.minute) };
    case "ACCOUNT_BACKFILL":
      return { outcome: platform === "META_INSTAGRAM" ? await backfillInstagram(now) : { status: "GONE", message: "X geçmiş vermez." }, next: null };
    case "POST_METRICS":
      return { outcome: { status: "ERROR", message: "Yanlış iş türü." }, next: null };
  }
}

export async function runMetricsTick(now: Date = new Date()): Promise<TickReport> {
  const report: TickReport = { processed: 0, ok: 0, deferred: 0, failed: 0, blocked: 0, released: 0 };
  const deadline = Date.now() + TIME_BUDGET_MS;
  await ensureJobs(now);

  for (;;) {
    const claimed = await claimDueJobs(now, BATCH);
    if (claimed.length === 0) break;
    const pending = new Set(claimed.map((job) => job.id));

    // Önce hesap işleri (günde/haftada bir, az sayıda), sonra gönderi işleri toplu (X 100'lük gruplar).
    for (const job of claimed.filter((item) => item.kind !== "POST_METRICS")) {
      if (Date.now() > deadline) break;
      const { outcome, next } = await runAccountJob(job, now);
      await finishJob(job.id, applyOutcome(job.attempts, outcome, next, now), now);
      pending.delete(job.id);
      tally(report, outcome);
    }
    const postJobs = claimed.filter((item) => item.kind === "POST_METRICS" && pending.has(item.id));
    if (Date.now() <= deadline) {
      await runPostJobs(postJobs, now, report);
      for (const job of postJobs) pending.delete(job.id);
    }
    if (pending.size > 0 || Date.now() > deadline) {
      report.released += pending.size;
      await releaseJobs([...pending]);
      break;
    }
  }
  return report;
}
