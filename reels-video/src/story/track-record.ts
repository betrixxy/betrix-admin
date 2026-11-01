import type { MatchData } from "./match-data";

/**
 * Modelin karnesi kuralı. Gerçek veride yalnız ReelSnapshot tabanlı sonuçlar sayılır: dondurulmuş hesap, başlama
 * öncesi olduğu kanıtlı tek kaynaktır. `sample` kaynağını yalnız örnekler açabilir; gerçek akış bu izni vermez.
 */

export const MIN_COMPLETED_MATCHES = 30;
/** Tek kovada bundan az maçla "%X'inde çıktı" denmez. */
export const MIN_BUCKET_MATCHES = 30;

export type TrackBucket = NonNullable<MatchData["model_track_record"]>["buckets"][number];
export type TrackDecision = { bucket: TrackBucket; reason: null } | { bucket: null; reason: string };

export function decideTrackRecord(record: MatchData["model_track_record"], leaderShare: number, options: { allowSample?: boolean } = {}): TrackDecision {
  if (!record) return { bucket: null, reason: "Tamamlanmış ReelSnapshot sonucu yok" };
  if (record.source === "sample" && !options.allowSample) return { bucket: null, reason: "Örnek karne gerçek akışta kullanılamaz" };
  if (record.completed_matches < MIN_COMPLETED_MATCHES) return { bucket: null, reason: `ReelSnapshot tabanlı tamamlanmış maç ${record.completed_matches}, en az ${MIN_COMPLETED_MATCHES} gerekli` };
  const bucket = record.buckets.find((item) => leaderShare >= item.from && leaderShare < item.to);
  if (!bucket || bucket.matches < MIN_BUCKET_MATCHES) return { bucket: null, reason: "Bu olasılık aralığında yeterli geçmiş maç yok" };
  return { bucket, reason: null };
}
