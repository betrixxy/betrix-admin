import type { Prisma } from "@/generated/prisma/client";
import { accountUpsertArgs } from "@/lib/metrics/account-row";
import { addDays, dayToDbDate, istanbulDay, istanbulDayBounds } from "@/lib/metrics/istanbul-time";
import { prisma } from "@/lib/prisma";
import { getAccessToken } from "@/lib/services/social/connections";
import {
  fetchIgAccountDayInsights,
  fetchIgDemographics,
  fetchIgFollowerSeries,
  fetchIgFollowsUnfollows,
  fetchIgUserCounts,
} from "@/lib/services/social/instagram-account";
import { mapIgAccountDaily, mapXAccountDaily, parseBreakdownBuckets, parseFollowerSeries, parseFollowsUnfollows } from "@/lib/services/social/metrics/account-mappers";
import { classifyMetaError, classifyXError } from "@/lib/services/social/metrics/errors";
import { fetchXMe } from "@/lib/services/social/x-api";
import { recordXRead } from "@/lib/services/social/x-usage";
import { AUDIENCE_BREAKDOWNS, AUDIENCE_TIMEFRAMES, type AccountMetricValues, type AudienceKind } from "@/types/account-metrics";
import type { PostCollectOutcome } from "@/types/post-metrics";
import type { SocialPlatformType } from "@/types/social";

/**
 * Hesap düzeyi günlük metrikler ve haftalık demografi (salt okuma — bkz. CLAUDE.md 1.10, 4.4). Reklam
 * görüşmeleri için takipçi büyümesi/günlük erişim bugünden itibaren biriktirilir; ilk çalıştırmada
 * Instagram'ın izin verdiği kadar (30 gün) geriye dönük doldurulur.
 */

export const ACCOUNT_PLATFORMS = ["META_INSTAGRAM", "X"] as const satisfies readonly SocialPlatformType[];
export type AccountPlatform = (typeof ACCOUNT_PLATFORMS)[number];
export const BACKFILL_DAYS = 30;

const json = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;

async function tokenFor(platform: AccountPlatform): Promise<{ ok: true; token: string; accountId: string } | { ok: false; outcome: PostCollectOutcome }> {
  const connection = await prisma.socialConnection.findUnique({ where: { platform } });
  if (!connection) return { ok: false, outcome: { status: "BLOCKED", message: "Hesap bağlı değil." } };
  const token = await getAccessToken(connection);
  if (!token.ok) return { ok: false, outcome: { status: "BLOCKED", message: token.error } };
  return { ok: true, token: token.data, accountId: connection.accountId };
}

async function upsertDay(platform: AccountPlatform, day: string, values: AccountMetricValues, raw: unknown, now: Date): Promise<void> {
  const args = accountUpsertArgs(platform, day, values, raw, now);
  await prisma.accountMetricSnapshot.upsert({
    where: args.where,
    update: { ...args.update, raw: json(raw) },
    create: { ...args.create, raw: json(raw) },
  });
}

/**
 * `day` (İstanbul günü) için hesap satırı. Etkileşim metrikleri o günü kapsar; takipçi sayısı çekim anının
 * değeridir — iş gün bittikten hemen sonra çalıştığı için gün sonu takipçisine eşittir.
 */
export async function collectAccountDaily(platform: AccountPlatform, day: string, now: Date = new Date()): Promise<PostCollectOutcome> {
  const auth = await tokenFor(platform);
  if (!auth.ok) return auth.outcome;

  if (platform === "X") {
    const me = await fetchXMe(auth.token);
    if (!me.ok) {
      const kind = classifyXError(me.error.message);
      return kind === "AUTH" ? { status: "BLOCKED", message: me.error.message } : kind === "RATE_LIMIT" ? { status: "DEFERRED", reason: "X hız/kredi sınırı." } : { status: "ERROR", message: me.error.message };
    }
    await recordXRead({ users: 1 }, now);
    await upsertDay(platform, day, mapXAccountDaily(me.data), me.data, now);
    return { status: "OK" };
  }

  const { start, end } = istanbulDayBounds(day);
  const [counts, insights, follows] = await Promise.all([
    fetchIgUserCounts(auth.token, auth.accountId),
    fetchIgAccountDayInsights(auth.token, auth.accountId, start, end),
    fetchIgFollowsUnfollows(auth.token, auth.accountId, start, end),
  ]);
  for (const result of [counts, insights]) {
    if (!result.ok && classifyMetaError(result.error.message) === "AUTH") return { status: "BLOCKED", message: result.error.message };
  }
  if (!counts.ok && !insights.ok) return { status: "ERROR", message: insights.error.message };
  // Takip/takipten çıkma 100 takipçinin altında gelmez — iş başarısız sayılmaz.
  const followSplit = follows.ok ? parseFollowsUnfollows(follows.data) : { follows: null, unfollows: null };
  const values = mapIgAccountDaily(counts.ok ? counts.data : null, insights.ok ? insights.data : null, followSplit);
  await upsertDay(platform, day, values, { counts: counts.ok ? counts.data : null, insights: insights.ok ? insights.data : null, follows: follows.ok ? follows.data : null }, now);
  return { status: "OK" };
}

/**
 * İlk çalıştırma: son 30 günün Instagram hesap metrikleri bir kez doldurulur (var olan satıra dokunulmaz).
 * Geçmiş toplam takipçi API'de yoktur; günlük yeni takipçi `follows` alanına yazılır. X geçmiş vermez.
 */
export async function backfillInstagram(now: Date = new Date()): Promise<PostCollectOutcome> {
  const auth = await tokenFor("META_INSTAGRAM");
  if (!auth.ok) return auth.outcome;
  const today = istanbulDay(now);
  const existing = new Set(
    (await prisma.accountMetricSnapshot.findMany({ where: { platform: "META_INSTAGRAM" }, select: { date: true } })).map((row) => row.date.toISOString().slice(0, 10)),
  );

  const first = istanbulDayBounds(addDays(today, -BACKFILL_DAYS)).start;
  const series = await fetchIgFollowerSeries(auth.token, auth.accountId, first, istanbulDayBounds(today).start);
  const newFollowers = new Map((series.ok ? parseFollowerSeries(series.data) : []).map((point) => [istanbulDay(new Date(new Date(point.endTime).getTime() - 1000)), point.value]));

  for (let offset = BACKFILL_DAYS; offset >= 1; offset -= 1) {
    const day = addDays(today, -offset);
    if (existing.has(day)) continue;
    const { start, end } = istanbulDayBounds(day);
    const insights = await fetchIgAccountDayInsights(auth.token, auth.accountId, start, end);
    if (!insights.ok) {
      if (classifyMetaError(insights.error.message) === "AUTH") return { status: "BLOCKED", message: insights.error.message };
      continue;
    }
    const values = { ...mapIgAccountDaily(null, insights.data, { follows: newFollowers.get(day) ?? null, unfollows: null }) };
    await prisma.accountMetricSnapshot.create({ data: { platform: "META_INSTAGRAM", date: dayToDbDate(day), capturedAt: now, backfilled: true, ...values, raw: json(insights.data) } });
  }
  return { status: "OK" };
}

/** Haftalık kitle demografisi (yalnızca Instagram — X API demografi vermez). Eşik altıysa kaydedilir, iş başarılı sayılır. */
export async function collectAudience(now: Date = new Date()): Promise<PostCollectOutcome> {
  const auth = await tokenFor("META_INSTAGRAM");
  if (!auth.ok) return auth.outcome;
  const rows: Prisma.AudienceSnapshotCreateManyInput[] = [];
  for (const kind of ["FOLLOWER", "ENGAGED"] as const satisfies readonly AudienceKind[]) {
    for (const timeframe of AUDIENCE_TIMEFRAMES) {
      for (const breakdown of AUDIENCE_BREAKDOWNS) {
        const result = await fetchIgDemographics(auth.token, auth.accountId, kind, timeframe, breakdown);
        if (!result.ok && classifyMetaError(result.error.message) === "AUTH") return { status: "BLOCKED", message: result.error.message };
        const metric = kind === "FOLLOWER" ? "follower_demographics" : "engaged_audience_demographics";
        const buckets = result.ok ? parseBreakdownBuckets(result.data, metric) : null;
        const unavailableReason = buckets ? null : result.ok ? "Meta veri vermedi (hesap eşiğin altında olabilir: 100 takipçi / 100 etkileşim)." : result.error.message.slice(0, 300);
        if (unavailableReason) console.info(`[audience] ${kind} ${timeframe} ${breakdown}: ${unavailableReason}`);
        rows.push({ platform: "META_INSTAGRAM", capturedAt: now, kind, timeframe, breakdown, ...(buckets ? { buckets } : {}), unavailableReason });
      }
    }
  }
  await prisma.audienceSnapshot.createMany({ data: rows });
  return { status: "OK" };
}
