import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { filterAndSortPosts, parsePostListFilters, postListQuery, type PostListRow } from "@/lib/dashboard/posts-list";

const row = (id: string, patch: Partial<PostListRow>): PostListRow => ({
  id,
  platform: "X",
  source: "PANEL",
  publishedAt: "2026-10-10T12:00:00.000Z",
  thumbnailUrl: null,
  permalink: null,
  mediaType: "IMAGE",
  contentType: null,
  likes: 0,
  comments: 0,
  shares: 0,
  saves: 0,
  reach: 0,
  views: 0,
  engagementRate: null,
  linkClicks: 0,
  siteVisitors: 0,
  lastSyncedAt: null,
  ...patch,
});

describe("gönderiler sayfası — filtre ve sıralama", () => {
  const rows = [
    row("a", { platform: "META_INSTAGRAM", likes: 50, publishedAt: "2026-10-01T20:30:00.000Z", contentType: "MATCH_DAY" }),
    row("b", { likes: 90, publishedAt: "2026-10-05T08:00:00.000Z" }),
    row("c", { likes: 10, engagementRate: 0.08, publishedAt: "2026-10-09T08:00:00.000Z", contentType: "MATCH_DAY" }),
  ];

  it("URL parametreleri; geçersizler varsayılana düşer", () => {
    const filters = parsePostListFilters({ platform: "x", from: "2026-10-02", to: "bozuk", sort: "likes", dir: "asc", type: "MATCH_DAY" });
    assert.deepEqual(filters, { platform: "X", from: "2026-10-02", to: null, contentType: "MATCH_DAY", sort: "likes", dir: "asc" });
    assert.equal(parsePostListFilters({}).sort, "date");
    assert.equal(postListQuery(filters, { sort: "date", dir: "desc" }), "?platform=x&from=2026-10-02&type=MATCH_DAY");
  });

  it("tarih aralığı İstanbul gününe göre (UTC 20:30 → ertesi gün 23:30 değil, aynı gün 23:30)", () => {
    const filters = parsePostListFilters({ from: "2026-10-02" });
    assert.deepEqual(filterAndSortPosts(rows, filters).map((item) => item.id), ["c", "b"]);
    assert.deepEqual(filterAndSortPosts(rows, parsePostListFilters({ to: "2026-10-01" })).map((item) => item.id), ["a"]);
  });

  it("platform, içerik türü ve 'türü yok' filtresi", () => {
    assert.deepEqual(filterAndSortPosts(rows, parsePostListFilters({ platform: "instagram" })).map((item) => item.id), ["a"]);
    assert.deepEqual(filterAndSortPosts(rows, parsePostListFilters({ type: "MATCH_DAY" })).map((item) => item.id), ["c", "a"]);
    assert.deepEqual(filterAndSortPosts(rows, parsePostListFilters({ type: "none" })).map((item) => item.id), ["b"]);
  });

  it("sütuna göre sıralama, oranı olmayan en sona", () => {
    assert.deepEqual(filterAndSortPosts(rows, parsePostListFilters({ sort: "likes" })).map((item) => item.id), ["b", "a", "c"]);
    assert.deepEqual(filterAndSortPosts(rows, parsePostListFilters({ sort: "likes", dir: "asc" })).map((item) => item.id), ["c", "a", "b"]);
    assert.equal(filterAndSortPosts(rows, parsePostListFilters({ sort: "engagement" }))[0]?.id, "c");
  });
});
