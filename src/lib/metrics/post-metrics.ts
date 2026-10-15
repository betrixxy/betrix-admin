import { collectInstagram } from "@/lib/metrics/collect-instagram";
import { collectX } from "@/lib/metrics/collect-x";
import { dueCheckpoint } from "@/lib/metrics/schedule";
import { loadTargets, type CollectTarget } from "@/lib/metrics/snapshot-store";
import { prisma } from "@/lib/prisma";
import { getAccessToken, recordSyncOutcome } from "@/lib/services/social/connections";
import type { MetricTrigger, PostCollectOutcome } from "@/types/post-metrics";
import type { SocialPlatformType } from "@/types/social";

/**
 * Gönderi metrik toplayıcısı (salt okuma — bkz. CLAUDE.md 1.10): verilen gönderileri platforma göre
 * gruplar, bağlantının token'ıyla çeker ve her biri için yeni `PostMetricSnapshot` yazar. Sonuç gönderi
 * başınadır; iş kuyruğu (`MetricJob`) yeniden deneme/durdurma kararını buradan verir.
 */

const DAY_MS = 86_400_000;

export interface CollectOptions {
  trigger: MetricTrigger;
  now?: Date;
  /** Snapshot'a yazılacak kontrol noktası etiketi (zamanlanmış çekimde). */
  checkpointOf?: (target: CollectTarget) => string | null;
}

function setAll(outcomes: Map<string, PostCollectOutcome>, targets: readonly CollectTarget[], outcome: PostCollectOutcome): void {
  for (const target of targets) outcomes.set(target.id, outcome);
}

function firstProblem(outcomes: ReadonlyMap<string, PostCollectOutcome>, targets: readonly CollectTarget[]): string | null {
  for (const target of targets) {
    const outcome = outcomes.get(target.id);
    if (outcome?.status === "ERROR" || outcome?.status === "BLOCKED") return outcome.message;
  }
  return null;
}

export async function collectPostMetrics(targets: readonly CollectTarget[], options: CollectOptions): Promise<Map<string, PostCollectOutcome>> {
  const now = options.now ?? new Date();
  const checkpointOf = options.checkpointOf ?? (() => null);
  const outcomes = new Map<string, PostCollectOutcome>();
  const byPlatform = new Map<SocialPlatformType, CollectTarget[]>();
  for (const target of targets) byPlatform.set(target.platformType, [...(byPlatform.get(target.platformType) ?? []), target]);

  // Platformlar sırayla işlenir — her sağlayıcının hız limitine öngörülebilir yük bindirilir.
  for (const [platform, group] of byPlatform) {
    if (platform !== "META_INSTAGRAM" && platform !== "X") {
      setAll(outcomes, group, { status: "GONE", message: "Bu platformun metrik çekimi henüz desteklenmiyor." });
      continue;
    }
    const connection = await prisma.socialConnection.findUnique({ where: { platform } });
    if (!connection) {
      setAll(outcomes, group, { status: "BLOCKED", message: "Hesap bağlı değil — Etkileşim & Reklam sayfasından bağlayın." });
      continue;
    }
    const token = await getAccessToken(connection);
    if (!token.ok) {
      setAll(outcomes, group, { status: "BLOCKED", message: token.error });
      await recordSyncOutcome(platform, token.error);
      continue;
    }
    const result =
      platform === "X"
        ? await collectX(token.data, connection.accountId, group, options.trigger, checkpointOf, now)
        : await collectInstagram(token.data, group, options.trigger, checkpointOf, now);
    for (const [id, outcome] of result) outcomes.set(id, outcome);
    await recordSyncOutcome(platform, firstProblem(result, group));
  }
  return outcomes;
}

/** Kademeli takvime göre şu an çekilmesi gereken gönderiler (otomatik pencere: son 31 gün). */
export async function loadDueTargets(now: Date = new Date()): Promise<{ targets: CollectTarget[]; checkpointOf: (target: CollectTarget) => string | null }> {
  const candidates = await loadTargets({ publishedAt: { gte: new Date(now.getTime() - 31 * DAY_MS) } });
  const labels = new Map<string, string>();
  const targets = candidates.filter((target) => {
    const due = dueCheckpoint(target.publishedAt, target.mediaType, target.lastCollectedAt, now);
    if (due) labels.set(target.id, due.label);
    return due !== null;
  });
  return { targets, checkpointOf: (target) => labels.get(target.id) ?? null };
}
