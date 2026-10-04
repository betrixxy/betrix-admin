import { metricsOf, pooledEngagementRate, publishedOnly } from "@/lib/dashboard/analytics-stats";
import type { DraftStatSelection } from "@/types/draft";
import {
  CONTENT_STAT_KEYS,
  type ContentInsights,
  type ContentStatKey,
  type SocialPostView,
  type StatInsight,
} from "@/types/social";

/**
 * "Hangi istatistik türü daha çok etkileşim getiriyor?" — içerik planlamasının veri temeli.
 * Her istatistik için, onu içeren gönderilerin toplu etkileşim oranı içermeyenlerle
 * karşılaştırılır (A/B benzeri basit bir kırılım; nedensellik iddiası taşımaz — maçın
 * büyüklüğü, platform ve saat gibi etkenler kontrol edilmez). Saf fonksiyonlar.
 */

/** Bir grupta bundan az gönderi varsa sonuç "düşük örneklem" olarak işaretlenir. */
export const MIN_INSIGHT_SAMPLE = 3;

const SELECTION_FIELD: Record<ContentStatKey, keyof DraftStatSelection> = {
  form: "includeForm",
  goals: "includeGoals",
  xg: "includeXg",
  headToHead: "includeHeadToHead",
};

/** Taslak seçiminden gönderide kullanılan istatistik kümesi. */
export function statKeysOf(selection: DraftStatSelection): ContentStatKey[] {
  return CONTENT_STAT_KEYS.filter((key) => selection[SELECTION_FIELD[key]]);
}

function average(posts: SocialPostView[], pick: (post: SocialPostView) => number): number {
  return posts.length > 0 ? posts.reduce((total, post) => total + pick(post), 0) / posts.length : 0;
}

function insightFor(stat: ContentStatKey, analyzed: SocialPostView[], statsByPost: ReadonlyMap<string, ReadonlySet<ContentStatKey>>): StatInsight {
  const withStat = analyzed.filter((post) => statsByPost.get(post.id)?.has(stat));
  const withoutStat = analyzed.filter((post) => !statsByPost.get(post.id)?.has(stat));
  const engagementWith = pooledEngagementRate(withStat);
  const engagementWithout = pooledEngagementRate(withoutStat);

  return {
    stat,
    postsWith: withStat.length,
    postsWithout: withoutStat.length,
    engagementWith,
    engagementWithout,
    avgCommentsWith: average(withStat, (post) => metricsOf(post).comments),
    avgSavesWith: average(withStat, (post) => metricsOf(post).saves),
    lift: withStat.length > 0 && engagementWithout > 0 ? engagementWith / engagementWithout - 1 : null,
    lowSample: withStat.length < MIN_INSIGHT_SAMPLE || withoutStat.length < MIN_INSIGHT_SAMPLE,
  };
}

/**
 * @param statsByPost Gönderi → bağlı AI içeriğinde kullanılan istatistikler. Haritada olmayan
 *                    (AI içeriği bağlanmamış) gönderiler analize girmez.
 */
export function computeContentInsights(
  posts: SocialPostView[],
  statsByPost: ReadonlyMap<string, ReadonlySet<ContentStatKey>>,
): ContentInsights {
  const analyzed = publishedOnly(posts).filter((post) => post.analytics !== null && statsByPost.has(post.id));

  const stats = CONTENT_STAT_KEYS.map((stat) => insightFor(stat, analyzed, statsByPost)).sort(
    (a, b) => (b.lift ?? -Infinity) - (a.lift ?? -Infinity),
  );
  const winner = stats.find((insight) => !insight.lowSample && (insight.lift ?? 0) > 0)?.stat ?? null;

  return { stats, analyzedPosts: analyzed.length, winner };
}
