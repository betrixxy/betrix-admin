import { istanbulDay } from "@/lib/metrics/istanbul-time";
import type { PostMediaType, PostSource, SocialPlatformType } from "@/types/social";

/** Gönderiler sayfası (/dashboard/posts) — satır tipi, URL filtreleri ve sıralama. Saf; istemcide de kullanılabilir. */

export interface PostListRow {
  id: string;
  platform: SocialPlatformType;
  source: PostSource;
  /** ISO 8601, UTC */
  publishedAt: string | null;
  thumbnailUrl: string | null;
  permalink: string | null;
  mediaType: PostMediaType | null;
  contentType: string | null;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  reach: number;
  /** Gösterim/izlenme (X'te gösterim; erişim yoksa kitle bu). */
  views: number;
  /** Etkileşim / erişim (erişim yoksa izlenme); veri yoksa null. */
  engagementRate: number | null;
  linkClicks: number;
  siteVisitors: number;
  /** ISO 8601 — son metrik çekimi. */
  lastSyncedAt: string | null;
}

export const POST_SORTS = ["date", "likes", "comments", "shares", "saves", "reach", "views", "engagement", "clicks", "visitors"] as const;
export type PostSort = (typeof POST_SORTS)[number];
export type SortDir = "asc" | "desc";

export interface PostListFilters {
  platform: "META_INSTAGRAM" | "X" | null;
  /** İstanbul günü `YYYY-MM-DD` (dahil). */
  from: string | null;
  to: string | null;
  /** İçerik türü kimliği; `"none"` = içerik türü olmayanlar (ör. içe aktarılan). */
  contentType: string | null;
  sort: PostSort;
  dir: SortDir;
}

type Param = string | string[] | undefined;
const one = (value: Param) => (typeof value === "string" ? value : undefined);
const DAY = /^\d{4}-\d{2}-\d{2}$/;

export function parsePostListFilters(params: Record<string, Param>): PostListFilters {
  const platform = one(params.platform);
  const from = one(params.from);
  const to = one(params.to);
  const type = one(params.type);
  return {
    platform: platform === "instagram" ? "META_INSTAGRAM" : platform === "x" ? "X" : null,
    from: from && DAY.test(from) ? from : null,
    to: to && DAY.test(to) ? to : null,
    contentType: type && /^[A-Za-z0-9_-]{1,64}$/.test(type) ? type : null,
    sort: POST_SORTS.find((sort) => sort === one(params.sort)) ?? "date",
    dir: one(params.dir) === "asc" ? "asc" : "desc",
  };
}

export function postListQuery(filters: PostListFilters, patch: Partial<PostListFilters> = {}): string {
  const next = { ...filters, ...patch };
  const query = new URLSearchParams();
  if (next.platform) query.set("platform", next.platform === "X" ? "x" : "instagram");
  if (next.from) query.set("from", next.from);
  if (next.to) query.set("to", next.to);
  if (next.contentType) query.set("type", next.contentType);
  if (next.sort !== "date") query.set("sort", next.sort);
  if (next.dir !== "desc") query.set("dir", next.dir);
  const text = query.toString();
  return text ? `?${text}` : "";
}

const SORT_VALUE: Record<PostSort, (row: PostListRow) => number> = {
  date: (row) => (row.publishedAt ? Date.parse(row.publishedAt) : 0),
  likes: (row) => row.likes,
  comments: (row) => row.comments,
  shares: (row) => row.shares,
  saves: (row) => row.saves,
  reach: (row) => row.reach,
  views: (row) => row.views,
  engagement: (row) => row.engagementRate ?? -1,
  clicks: (row) => row.linkClicks,
  visitors: (row) => row.siteVisitors,
};

export function filterAndSortPosts(rows: readonly PostListRow[], filters: PostListFilters): PostListRow[] {
  const filtered = rows.filter((row) => {
    if (filters.platform && row.platform !== filters.platform) return false;
    const day = row.publishedAt ? istanbulDay(new Date(row.publishedAt)) : null;
    if (filters.from && (!day || day < filters.from)) return false;
    if (filters.to && (!day || day > filters.to)) return false;
    if (filters.contentType === "none" && row.contentType !== null) return false;
    if (filters.contentType && filters.contentType !== "none" && row.contentType !== filters.contentType) return false;
    return true;
  });
  const value = SORT_VALUE[filters.sort];
  const sign = filters.dir === "asc" ? 1 : -1;
  return filtered.sort((a, b) => sign * (value(a) - value(b)) || (SORT_VALUE.date(b) - SORT_VALUE.date(a)));
}
