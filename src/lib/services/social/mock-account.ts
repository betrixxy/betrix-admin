import { createHash } from "node:crypto";

/**
 * Hesap düzeyi mock yanıtlar (bkz. CLAUDE.md 5.2) — sağlayıcıların ham biçiminde; gerçek şema ve
 * mapper'lardan geçer. Değerler günden deterministik türetilir, takipçi zamanla yavaşça artar.
 */

function seed(key: string): number {
  return createHash("sha256").update(key).digest().readUInt32BE(0) / 0xffffffff;
}

const DAY_MS = 86_400_000;
const BASE_FOLLOWERS = 4_200;

function followersAt(at: Date): number {
  const days = Math.floor(at.getTime() / DAY_MS) - 20_000;
  return BASE_FOLLOWERS + days * 9 + Math.round(seed(`f${days}`) * 30);
}

export function mockIgUserCounts(igUserId: string): unknown {
  return { id: igUserId, followers_count: followersAt(new Date()), follows_count: 180, media_count: 412 };
}

export function mockIgAccountInsights(igUserId: string, dayStart: Date): unknown {
  const key = `${igUserId}:${dayStart.toISOString().slice(0, 10)}`;
  const reach = 3_000 + Math.round(seed(`${key}:reach`) * 9_000);
  const total = (name: string, value: number) => ({ name, period: "day", total_value: { value } });
  return {
    data: [
      total("reach", reach),
      total("views", Math.round(reach * 2.4)),
      total("accounts_engaged", Math.round(reach * 0.06)),
      total("total_interactions", Math.round(reach * 0.09)),
      total("likes", Math.round(reach * 0.07)),
      total("comments", Math.round(reach * 0.008)),
      total("shares", Math.round(reach * 0.006)),
      total("saves", Math.round(reach * 0.01)),
      total("profile_links_taps", Math.round(reach * 0.004)),
      {
        name: "follows_and_unfollows",
        period: "day",
        total_value: {
          breakdowns: [
            { dimension_keys: ["follow_type"], results: [{ dimension_values: ["FOLLOWER"], value: 14 }, { dimension_values: ["NON_FOLLOWER"], value: 5 }] },
          ],
        },
      },
    ],
  };
}

export function mockIgFollowerSeries(start: Date, end: Date): unknown {
  const values: { value: number; end_time: string }[] = [];
  for (let at = start.getTime(); at < end.getTime(); at += DAY_MS) {
    values.push({ value: 8 + Math.round(seed(`g${at}`) * 12), end_time: new Date(at + DAY_MS).toISOString() });
  }
  return { data: [{ name: "follower_count", period: "day", values }] };
}

const DEMO_BUCKETS: Record<string, string[]> = {
  age: ["13-17", "18-24", "25-34", "35-44", "45-54", "55-64", "65+"],
  gender: ["M", "F", "U"],
  city: ["Istanbul, Istanbul Province", "Ankara, Ankara Province", "Izmir, Izmir Province", "Bursa, Bursa Province"],
  country: ["TR", "DE", "NL", "AZ"],
};

export function mockIgDemographics(metric: string, breakdown: string): unknown {
  const results = (DEMO_BUCKETS[breakdown] ?? []).map((bucket) => ({ dimension_values: [bucket], value: 20 + Math.round(seed(`${metric}:${bucket}`) * 900) }));
  return { data: [{ name: metric, period: "lifetime", total_value: { breakdowns: [{ dimension_keys: [breakdown], results }] } }] };
}

export function mockXMe(userId: string): unknown {
  const followers = Math.round(followersAt(new Date()) * 0.6);
  return { data: { id: userId, username: "checkmatch_mock", public_metrics: { followers_count: followers, following_count: 95, tweet_count: 1_830, listed_count: 4 } } };
}
