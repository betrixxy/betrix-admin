import { checkpointLabelAt } from "@/lib/metrics/schedule";
import { writeSnapshot, type CollectTarget } from "@/lib/metrics/snapshot-store";
import { fetchIgMediaInsights } from "@/lib/services/social/instagram-graph";
import { classifyMetaError } from "@/lib/services/social/metrics/errors";
import { mapIgInsights } from "@/lib/services/social/metrics/post-mappers";
import type { MetricTrigger, PostCollectOutcome } from "@/types/post-metrics";

/** Instagram gönderi metrikleri: gönderi başına bir `/{media-id}/insights` çağrısı (Meta'da ücret yok). */

const STORY_LIFETIME_MS = 24 * 3_600_000;

export async function collectInstagram(
  accessToken: string,
  targets: readonly CollectTarget[],
  trigger: MetricTrigger,
  checkpointOf: (target: CollectTarget) => string | null,
  now: Date,
): Promise<Map<string, PostCollectOutcome>> {
  const outcomes = new Map<string, PostCollectOutcome>();
  for (const target of targets) {
    if (target.mediaType === "STORY" && now.getTime() - target.publishedAt.getTime() > STORY_LIFETIME_MS) {
      outcomes.set(target.id, { status: "GONE", message: "Story metrikleri 24 saat sonra alınamaz." });
      continue;
    }
    const result = await fetchIgMediaInsights(accessToken, target.providerPostId, target.mediaType);
    if (!result.ok) {
      const kind = classifyMetaError(result.error.message);
      if (kind === "AUTH") {
        // Token sorunu tüm gönderileri etkiler — kalanlar da durdurulur.
        for (const rest of targets) if (!outcomes.has(rest.id)) outcomes.set(rest.id, { status: "BLOCKED", message: result.error.message });
        break;
      }
      outcomes.set(
        target.id,
        kind === "GONE"
          ? { status: "GONE", message: "Gönderi Instagram'da bulunamadı (silinmiş olabilir)." }
          : kind === "RATE_LIMIT"
            ? { status: "DEFERRED", reason: "Instagram hız limiti — sonra denenecek." }
            : { status: "ERROR", message: result.error.message },
      );
      continue;
    }
    await writeSnapshot({
      target,
      mapped: mapIgInsights(result.data.raw),
      trigger,
      checkpoint: checkpointOf(target) ?? (trigger === "SCHEDULED" ? checkpointLabelAt(target.publishedAt, target.mediaType, now) : null),
      raw: result.data.raw,
      now,
    });
    outcomes.set(target.id, { status: "OK" });
  }
  return outcomes;
}
