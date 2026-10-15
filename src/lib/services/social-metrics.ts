import { collectPostMetrics, loadDueTargets } from "@/lib/metrics/post-metrics";
import { loadTargets } from "@/lib/metrics/snapshot-store";
import { prisma } from "@/lib/prisma";
import type { SyncReport } from "@/types/social-connection";
import type { SocialPlatformType } from "@/types/social";

/**
 * Etkileşim panelindeki "Senkronize et" düğmesi: zamanı gelen (ya da `force` ile tüm) gönderilerin
 * metriklerini hemen çeker. Otomatik çekim aynı toplayıcıyı (`lib/metrics/post-metrics.ts`) saatlik iş
 * kuyruğundan çağırır (bkz. CLAUDE.md 4.4).
 */

export interface SyncOptions {
  /** Kademeli takvimi yok sayıp bağlı platformlardaki tüm yayınlanmış gönderileri çeker. */
  force?: boolean;
}

/** Aynı süreçte eşzamanlı iki senkronizasyon aynı gönderileri iki kez çekmesin. */
let inFlight: Promise<SyncReport> | null = null;

export function syncSocialMetrics(options: SyncOptions = {}): Promise<SyncReport> {
  inFlight ??= runSync(options).finally(() => {
    inFlight = null;
  });
  return inFlight;
}

async function runSync(options: SyncOptions): Promise<SyncReport> {
  const connected = (await prisma.socialConnection.findMany({ select: { platform: true } })).map((row) => row.platform);
  const due = options.force ? null : await loadDueTargets();
  const targets = (due ? due.targets : await loadTargets({})).filter((target) => connected.includes(target.platformType));
  const outcomes = await collectPostMetrics(targets, { trigger: "MANUAL", ...(due ? { checkpointOf: due.checkpointOf } : {}) });

  const report: SyncReport = { updated: 0, skipped: 0, failures: [] };
  const failed = new Map<SocialPlatformType, string>();
  for (const target of targets) {
    const outcome = outcomes.get(target.id);
    if (outcome?.status === "OK") report.updated += 1;
    else report.skipped += 1;
    if ((outcome?.status === "ERROR" || outcome?.status === "BLOCKED") && !failed.has(target.platformType)) failed.set(target.platformType, outcome.message);
  }
  report.failures = [...failed].map(([platform, message]) => ({ platform, message }));
  return report;
}
