import { socialUseMocks } from "@/lib/env";
import { nextUtcDayStart } from "@/lib/metrics/job-policy";
import { refreshedTooRecently, X_MIN_REFRESH_MS } from "@/lib/metrics/schedule";
import { writeSnapshot, type CollectTarget } from "@/lib/metrics/snapshot-store";
import { chooseXReadPath, chunk, splitByPrivateWindow } from "@/lib/metrics/x-plan";
import { prisma } from "@/lib/prisma";
import type { SocialApiError } from "@/lib/services/social/client";
import { classifyXError } from "@/lib/services/social/metrics/errors";
import { mapXTweetMetrics } from "@/lib/services/social/metrics/post-mappers";
import { fetchOwnTweets, lookupTweets, X_PAGE_MAX } from "@/lib/services/social/x-api";
import type { XTweetListRaw, XTweetRaw } from "@/lib/services/social/x-raw";
import { recordXRead, xPostAllowance } from "@/lib/services/social/x-usage";
import type { MetricTrigger, PostCollectOutcome } from "@/types/post-metrics";
import type { Result } from "@/types/result";

/**
 * X gönderi metrikleri — kredi korumalı (bkz. CLAUDE.md 4.5): aynı gönderi 1 saatten sık çekilmez, istekler
 * 100'lük gruplarla yapılır, günlük okuma sınırı (`X_DAILY_READ_LIMIT`) aşılmaz — sınırda kalan gönderiler
 * ertelenir. Son 30 günün gönderilerinde `non_public_metrics`/`organic_metrics` istenir; X bunları
 * reddederse istek sessizce yalnızca `public_metrics` ile tekrarlanır.
 */

const BUDGET_REASON = "Günlük X okuma sınırına (X_DAILY_READ_LIMIT) ulaşıldı — yarın devam edecek.";

interface FetchState {
  tweets: Map<string, XTweetRaw>;
  /** Pencere/kimlik sorgusu tamamlandı mı (bulunamayan = silinmiş sayılabilir). */
  complete: boolean;
  error: SocialApiError | null;
}

/** Özel metrik alanları reddedilirse aynı isteği yalnızca public alanlarla tekrarlar. */
async function withPrivateFallback(includePrivate: boolean, call: (priv: boolean) => Promise<Result<XTweetListRaw, SocialApiError>>): Promise<Result<XTweetListRaw, SocialApiError>> {
  const first = await call(includePrivate);
  if (first.ok || !includePrivate || classifyXError(first.error.message) !== "INVALID_REQUEST") return first;
  return call(false);
}

async function fetchByIds(accessToken: string, ids: string[], includePrivate: boolean): Promise<FetchState> {
  const state: FetchState = { tweets: new Map(), complete: true, error: null };
  for (const group of chunk(ids, X_PAGE_MAX)) {
    const allowance = await xPostAllowance(group.length);
    const batch = group.slice(0, allowance);
    if (batch.length === 0) {
      state.complete = false;
      break;
    }
    const result = await withPrivateFallback(includePrivate, (priv) => lookupTweets(accessToken, batch, priv));
    if (!result.ok) return { ...state, complete: false, error: result.error };
    const data = result.data.data ?? [];
    await recordXRead({ posts: data.length });
    for (const tweet of data) state.tweets.set(tweet.id, tweet);
    if (batch.length < group.length) {
      state.complete = false;
      break;
    }
  }
  return state;
}

async function fetchByTimeline(accessToken: string, userId: string, start: Date, end: Date, includePrivate: boolean): Promise<FetchState> {
  const state: FetchState = { tweets: new Map(), complete: false, error: null };
  let paginationToken: string | undefined;
  for (;;) {
    const allowance = await xPostAllowance(X_PAGE_MAX);
    if (allowance === 0) return state;
    const page = await withPrivateFallback(includePrivate, (priv) =>
      fetchOwnTweets({
        accessToken,
        userId,
        maxResults: allowance,
        includePrivate: priv,
        startTime: new Date(start.getTime() - 1000).toISOString(),
        endTime: new Date(end.getTime() + 1000).toISOString(),
        ...(paginationToken ? { paginationToken } : {}),
      }),
    );
    if (!page.ok) return { ...state, error: page.error };
    const data = page.data.data ?? [];
    await recordXRead({ posts: data.length });
    for (const tweet of data) state.tweets.set(tweet.id, tweet);
    paginationToken = page.data.meta?.next_token;
    if (!paginationToken) return { ...state, complete: true };
  }
}

function failureOutcome(error: SocialApiError): PostCollectOutcome {
  const kind = classifyXError(error.message);
  if (kind === "AUTH") return { status: "BLOCKED", message: error.message };
  if (kind === "RATE_LIMIT") return { status: "DEFERRED", reason: "X hız/kredi sınırı (429) — sonra denenecek." };
  return { status: "ERROR", message: error.message };
}

export async function collectX(
  accessToken: string,
  userId: string,
  targets: readonly CollectTarget[],
  trigger: MetricTrigger,
  checkpointOf: (target: CollectTarget) => string | null,
  now: Date,
): Promise<Map<string, PostCollectOutcome>> {
  const outcomes = new Map<string, PostCollectOutcome>();
  const eligible = targets.filter((target) => {
    if (!refreshedTooRecently(target.lastCapturedAt, now, X_MIN_REFRESH_MS)) return true;
    const until = new Date((target.lastCapturedAt?.getTime() ?? now.getTime()) + X_MIN_REFRESH_MS + 60_000);
    outcomes.set(target.id, { status: "DEFERRED", reason: "Son çekimin üzerinden 1 saat geçmedi (X kredi koruması).", until });
    return false;
  });

  const { recent, old } = splitByPrivateWindow(eligible, now);
  for (const [group, includePrivate] of [[recent, true], [old, false]] as const) {
    if (group.length === 0) continue;
    const times = group.map((target) => target.publishedAt.getTime());
    const start = new Date(Math.min(...times));
    const end = new Date(Math.max(...times));
    const windowCount = socialUseMocks ? Number.POSITIVE_INFINITY : await prisma.socialPost.count({ where: { platform: { type: "X" }, publishedAt: { gte: start, lte: end } } });
    const state =
      chooseXReadPath(group.length, windowCount) === "timeline"
        ? await fetchByTimeline(accessToken, userId, start, end, includePrivate)
        : await fetchByIds(accessToken, group.map((target) => target.providerPostId), includePrivate);

    for (const target of group) {
      const tweet = state.tweets.get(target.providerPostId);
      if (tweet) {
        await writeSnapshot({ target, mapped: mapXTweetMetrics(tweet), trigger, checkpoint: checkpointOf(target), raw: tweet, now });
        outcomes.set(target.id, { status: "OK" });
      } else if (state.error) {
        outcomes.set(target.id, failureOutcome(state.error));
      } else if (state.complete) {
        outcomes.set(target.id, { status: "GONE", message: "Gönderi X'te bulunamadı (silinmiş olabilir)." });
      } else {
        outcomes.set(target.id, { status: "DEFERRED", reason: BUDGET_REASON, until: nextUtcDayStart(now) });
      }
    }
  }
  return outcomes;
}
