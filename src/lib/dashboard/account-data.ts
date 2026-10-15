import { addDays, istanbulDay } from "@/lib/metrics/istanbul-time";
import { prisma } from "@/lib/prisma";

/**
 * Hesap geneli grafiklerin verisi (reklam görüşmeleri için): takipçi büyümesi (son 90 gün, platform başına)
 * ve son 30 günün günlük erişimi/görüntülenmesi (Instagram — X API hesap erişimi vermez).
 */

export interface FollowerPoint {
  day: string;
  instagram: number | null;
  x: number | null;
}

export interface ReachPoint {
  day: string;
  reach: number | null;
  views: number | null;
  accountsEngaged: number | null;
}

export interface AccountSummary {
  platform: "META_INSTAGRAM" | "X";
  followers: number | null;
  /** Son 30 günde takipçi değişimi (iki uçta da veri varsa). */
  growth30: number | null;
}

export interface AccountSeries {
  followers: FollowerPoint[];
  reach: ReachPoint[];
  summaries: AccountSummary[];
}

export async function getAccountSeries(now: Date = new Date()): Promise<AccountSeries> {
  const today = istanbulDay(now);
  const rows = await prisma.accountMetricSnapshot.findMany({
    where: { date: { gte: new Date(`${addDays(today, -90)}T00:00:00Z`) }, platform: { in: ["META_INSTAGRAM", "X"] } },
    orderBy: { date: "asc" },
    select: { platform: true, date: true, followerCount: true, reach: true, views: true, accountsEngaged: true },
  });
  const byDay = new Map<string, FollowerPoint>();
  const reach: ReachPoint[] = [];
  const reachFrom = addDays(today, -30);
  for (const row of rows) {
    const day = row.date.toISOString().slice(0, 10);
    if (row.followerCount !== null) {
      const point = byDay.get(day) ?? { day, instagram: null, x: null };
      if (row.platform === "X") point.x = row.followerCount;
      else point.instagram = row.followerCount;
      byDay.set(day, point);
    }
    if (row.platform === "META_INSTAGRAM" && day >= reachFrom) reach.push({ day, reach: row.reach, views: row.views, accountsEngaged: row.accountsEngaged });
  }
  const followers = [...byDay.values()];
  const summaries: AccountSummary[] = (["META_INSTAGRAM", "X"] as const).map((platform) => {
    const key = platform === "X" ? "x" : "instagram";
    const known = followers.filter((point) => point[key] !== null);
    const last = known.at(-1);
    const base = known.find((point) => point.day >= addDays(today, -31));
    return {
      platform,
      followers: last?.[key] ?? null,
      growth30: last && base && last !== base ? (last[key] ?? 0) - (base[key] ?? 0) : null,
    };
  });
  return { followers, reach, summaries };
}
