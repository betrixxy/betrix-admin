import { socialUseMocks } from "@/lib/env";
import { getJson, type SocialApiError } from "@/lib/services/social/client";
import { mockXTweetPage } from "@/lib/services/social/mock-import";
import { xTweetListSchema, type XTweetListRaw } from "@/lib/services/social/x-raw";
import type { Result } from "@/types/result";

/**
 * X API v2 okuma çağrıları (yalnızca GET — bkz. CLAUDE.md 1.10). Ücretlendirme dönen kaynak başınadır
 * (CLAUDE.md 4.5): kendi zaman akışımız (`/2/users/:id/tweets`) "owned read" ile gönderi başına $0.001,
 * kimlikle sorgu (`/2/tweets?ids=`) $0.005. Çağıran kod okunan gönderi sayısını `x-usage.ts` ile kaydeder.
 */

const API = "https://api.x.com/2";
/** X'in sayfa/kimlik sorgusu başına üst sınırı. */
export const X_PAGE_MAX = 100;
const X_PAGE_MIN = 5;

const PUBLIC_FIELDS = "created_at,public_metrics,attachments";
/** Yalnızca kendi gönderilerimizde ve son 30 günde döner. */
const PRIVATE_FIELDS = "non_public_metrics,organic_metrics";

function commonParams(includePrivate: boolean): URLSearchParams {
  return new URLSearchParams({
    "tweet.fields": includePrivate ? `${PUBLIC_FIELDS},${PRIVATE_FIELDS}` : PUBLIC_FIELDS,
    expansions: "attachments.media_keys",
    "media.fields": "type,url,preview_image_url",
  });
}

const auth = (accessToken: string): RequestInit => ({ headers: { Authorization: `Bearer ${accessToken}` } });

export interface OwnTweetsRequest {
  accessToken: string;
  userId: string;
  /** 5–100; daha azı istenirse X yine 5 döner, çağıran kesip kullanır. */
  maxResults: number;
  paginationToken?: string;
  /** ISO 8601 — pencere başı/sonu (dahil). */
  startTime?: string;
  endTime?: string;
  includePrivate: boolean;
}

/** Kendi zaman akışımız (yeniden paylaşım ve yanıtlar hariç), yeniden eskiye, tek sayfa. */
export async function fetchOwnTweets(request: OwnTweetsRequest): Promise<Result<XTweetListRaw, SocialApiError>> {
  const maxResults = Math.min(X_PAGE_MAX, Math.max(X_PAGE_MIN, request.maxResults));
  if (socialUseMocks) {
    const parsed = xTweetListSchema.safeParse(mockXTweetPage(maxResults, request.includePrivate));
    return parsed.success ? { ok: true, data: parsed.data } : { ok: false, error: { code: "INVALID_RESPONSE", message: "Mock X yanıtı şemaya uymuyor." } };
  }
  const params = commonParams(request.includePrivate);
  params.set("max_results", String(maxResults));
  params.set("exclude", "retweets,replies");
  if (request.paginationToken) params.set("pagination_token", request.paginationToken);
  if (request.startTime) params.set("start_time", request.startTime);
  if (request.endTime) params.set("end_time", request.endTime);
  return getJson(`${API}/users/${encodeURIComponent(request.userId)}/tweets?${params.toString()}`, auth(request.accessToken), xTweetListSchema, "X zaman akışı");
}

/** Kimlikle toplu sorgu (en fazla 100). */
export async function lookupTweets(accessToken: string, ids: readonly string[], includePrivate: boolean): Promise<Result<XTweetListRaw, SocialApiError>> {
  if (ids.length === 0) return { ok: true, data: {} };
  if (ids.length > X_PAGE_MAX) return { ok: false, error: { code: "HTTP", message: `X tek sorguda en fazla ${X_PAGE_MAX} gönderi kabul eder.` } };
  if (socialUseMocks) {
    const page = mockXTweetPage(X_PAGE_MAX, includePrivate) as { data: { id: string }[] };
    const wanted = new Set(ids);
    const parsed = xTweetListSchema.safeParse({ ...page, data: page.data.filter((tweet) => wanted.has(tweet.id)) });
    return parsed.success ? { ok: true, data: parsed.data } : { ok: false, error: { code: "INVALID_RESPONSE", message: "Mock X yanıtı şemaya uymuyor." } };
  }
  const params = commonParams(includePrivate);
  params.set("ids", ids.join(","));
  return getJson(`${API}/tweets?${params.toString()}`, auth(accessToken), xTweetListSchema, "X gönderi sorgusu");
}
