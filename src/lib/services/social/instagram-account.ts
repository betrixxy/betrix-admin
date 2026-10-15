import { socialUseMocks } from "@/lib/env";
import { getJson, type SocialApiError } from "@/lib/services/social/client";
import { igInsightsSchema, type IgInsightsRaw } from "@/lib/services/social/instagram-raw";
import { igUserCountsSchema, type IgUserCountsRaw } from "@/lib/services/social/metrics/account-mappers";
import { classifyMetaError } from "@/lib/services/social/metrics/errors";
import { mockIgAccountInsights, mockIgDemographics, mockIgFollowerSeries, mockIgUserCounts } from "@/lib/services/social/mock-account";
import { META_GRAPH_VERSION } from "@/lib/services/social/oauth-providers";
import type { AudienceBreakdown, AudienceKind, AudienceTimeframe } from "@/types/account-metrics";
import type { Result } from "@/types/result";

/**
 * Instagram hesap düzeyi okuma çağrıları (yalnızca GET — bkz. CLAUDE.md 1.10). Metrik adları güncel Graph API
 * belgesinden (instagram-user/insights, 2026-10): `impressions` ve `profile_views` artık yok; günlük metrikler
 * `metric_type=total_value` + `period=day` + `since/until` ile, demografi `timeframe` (this_week | this_month) ile.
 */

const GRAPH = `https://graph.facebook.com/${META_GRAPH_VERSION}`;

export const IG_ACCOUNT_DAILY_METRICS = [
  "reach",
  "views",
  "accounts_engaged",
  "total_interactions",
  "likes",
  "comments",
  "shares",
  "saves",
  "profile_links_taps",
] as const;

type Params = Record<string, string>;

function graphUrl(path: string, accessToken: string, params: Params): string {
  const url = new URL(`${GRAPH}/${path}`);
  url.search = new URLSearchParams({ ...params, access_token: accessToken }).toString();
  return url.toString();
}

function parseMock<T>(schema: { safeParse: (value: unknown) => { success: true; data: T } | { success: false } }, payload: unknown): Result<T, SocialApiError> {
  const parsed = schema.safeParse(payload);
  return parsed.success ? { ok: true, data: parsed.data } : { ok: false, error: { code: "INVALID_RESPONSE", message: "Mock Instagram yanıtı şemaya uymuyor." } };
}

export async function fetchIgUserCounts(accessToken: string, igUserId: string): Promise<Result<IgUserCountsRaw, SocialApiError>> {
  if (socialUseMocks) return parseMock(igUserCountsSchema, mockIgUserCounts(igUserId));
  return getJson(graphUrl(encodeURIComponent(igUserId), accessToken, { fields: "followers_count,follows_count,media_count" }), {}, igUserCountsSchema, "Instagram hesap sayaçları");
}

async function insights(accessToken: string, igUserId: string, params: Params, what: string): Promise<Result<IgInsightsRaw, SocialApiError>> {
  return getJson(graphUrl(`${encodeURIComponent(igUserId)}/insights`, accessToken, params), {}, igInsightsSchema, what);
}

const unixSeconds = (date: Date) => String(Math.floor(date.getTime() / 1000));

/**
 * Bir günün hesap metrikleri. Bir metrik desteklenmezse Meta tüm isteği reddeder; o zaman metrikler tek tek
 * istenir ve yalnızca desteklenenler birleştirilir ("in development" metrikler hesap/sürüme göre değişebilir).
 */
export async function fetchIgAccountDayInsights(accessToken: string, igUserId: string, start: Date, end: Date): Promise<Result<IgInsightsRaw, SocialApiError>> {
  if (socialUseMocks) return parseMock(igInsightsSchema, mockIgAccountInsights(igUserId, start));
  const base = { metric_type: "total_value", period: "day", since: unixSeconds(start), until: unixSeconds(end) };
  const all = await insights(accessToken, igUserId, { ...base, metric: IG_ACCOUNT_DAILY_METRICS.join(",") }, "Instagram hesap metrikleri");
  if (all.ok || classifyMetaError(all.error.message) !== "INVALID_REQUEST") return all;

  const data: IgInsightsRaw["data"] = [];
  for (const metric of IG_ACCOUNT_DAILY_METRICS) {
    const one = await insights(accessToken, igUserId, { ...base, metric }, "Instagram hesap metrikleri");
    if (one.ok) data.push(...one.data.data);
    else if (classifyMetaError(one.error.message) === "AUTH") return one;
  }
  return { ok: true, data: { data } };
}

/** `follows_and_unfollows` (follow_type kırılımı) — 100 takipçinin altında Meta vermez. */
export async function fetchIgFollowsUnfollows(accessToken: string, igUserId: string, start: Date, end: Date): Promise<Result<IgInsightsRaw, SocialApiError>> {
  if (socialUseMocks) return parseMock(igInsightsSchema, mockIgAccountInsights(igUserId, start));
  return insights(
    accessToken,
    igUserId,
    { metric: "follows_and_unfollows", metric_type: "total_value", period: "day", breakdown: "follow_type", since: unixSeconds(start), until: unixSeconds(end) },
    "Instagram takip/takipten çıkma",
  );
}

/** Günlük yeni takipçi serisi (`follower_count`, period=day) — geriye dönük doldurma için; son 30 gün. */
export async function fetchIgFollowerSeries(accessToken: string, igUserId: string, start: Date, end: Date): Promise<Result<IgInsightsRaw, SocialApiError>> {
  if (socialUseMocks) return parseMock(igInsightsSchema, mockIgFollowerSeries(start, end));
  return insights(accessToken, igUserId, { metric: "follower_count", period: "day", since: unixSeconds(start), until: unixSeconds(end) }, "Instagram takipçi serisi");
}

const AUDIENCE_METRIC: Record<AudienceKind, string> = { FOLLOWER: "follower_demographics", ENGAGED: "engaged_audience_demographics" };

export async function fetchIgDemographics(
  accessToken: string,
  igUserId: string,
  kind: AudienceKind,
  timeframe: AudienceTimeframe,
  breakdown: AudienceBreakdown,
): Promise<Result<IgInsightsRaw, SocialApiError>> {
  if (socialUseMocks) return parseMock(igInsightsSchema, mockIgDemographics(AUDIENCE_METRIC[kind], breakdown));
  return insights(accessToken, igUserId, { metric: AUDIENCE_METRIC[kind], period: "lifetime", metric_type: "total_value", timeframe, breakdown }, "Instagram kitle demografisi");
}
