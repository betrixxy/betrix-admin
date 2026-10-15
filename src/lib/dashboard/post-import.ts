import { ensurePlatformRow } from "@/lib/dashboard/post-registry";
import { computePostFeaturesSafe } from "@/lib/metrics/feature-store";
import { writeSnapshot } from "@/lib/metrics/snapshot-store";
import { prisma } from "@/lib/prisma";
import { getAccessToken } from "@/lib/services/social/connections";
import { mapInstagramMedia, mapXTweetList, planImport } from "@/lib/services/social/import-mappers";
import { listInstagramMedia } from "@/lib/services/social/instagram-graph";
import { mapIgMediaCounts, mapXTweetMetrics } from "@/lib/services/social/metrics/post-mappers";
import { fetchOwnTweets, X_PAGE_MAX } from "@/lib/services/social/x-api";
import { recordXRead, xPostAllowance } from "@/lib/services/social/x-usage";
import type { MappedPostMetrics } from "@/types/post-metrics";
import type { Result } from "@/types/result";
import type { ImportedPost, ImportPlatform, ImportReport } from "@/types/social";

/**
 * "Geçmiş gönderileri içe aktar": bağlı hesabın platformdaki gönderilerini SocialPost (IMPORTED) olarak
 * kaydeder. Yalnızca okuma yapar; idempotenttir (aynı `providerPostId` ikinci kez eklenmez). X'te okunan
 * her gönderi kredi harcar — günlük sınır (`X_DAILY_READ_LIMIT`) aşılmaz (bkz. CLAUDE.md 4.5).
 */

export const IMPORT_DEFAULT_COUNT = 100;
export const IMPORT_MAX_COUNT = 1000;

type ImportError = { code: string; message: string };
const fail = (code: string, message: string): { ok: false; error: ImportError } => ({ ok: false, error: { code, message } });

interface Fetched {
  posts: ImportedPost[];
  /** İçe aktarma yanıtında gelen ilk sayaçlar (providerPostId → değerler + ham öğe). */
  initial: Map<string, { mapped: MappedPostMetrics; raw: unknown }>;
  limitedBy: string | null;
}

async function fetchInstagram(accessToken: string, igUserId: string, count: number): Promise<Result<Fetched, ImportError>> {
  const media = await listInstagramMedia(accessToken, igUserId, count);
  if (!media.ok) return fail(media.error.code, media.error.message);
  const initial = new Map(media.data.map((item) => [item.id, { mapped: mapIgMediaCounts(item), raw: item }]));
  return { ok: true, data: { posts: media.data.map(mapInstagramMedia).filter((post): post is ImportedPost => post !== null), initial, limitedBy: null } };
}

async function fetchX(accessToken: string, userId: string, username: string | null, count: number): Promise<Result<Fetched, ImportError>> {
  const posts: ImportedPost[] = [];
  const initial: Fetched["initial"] = new Map();
  let paginationToken: string | undefined;
  let limitedBy: string | null = null;
  while (posts.length < count) {
    const allowance = await xPostAllowance(Math.min(X_PAGE_MAX, count - posts.length));
    if (allowance === 0) {
      limitedBy = "Günlük X okuma sınırına (X_DAILY_READ_LIMIT) ulaşıldı — kalan gönderiler yarın içe aktarılabilir.";
      break;
    }
    const page = await fetchOwnTweets({ accessToken, userId, maxResults: allowance, includePrivate: false, ...(paginationToken ? { paginationToken } : {}) });
    if (!page.ok) return fail(page.error.code, page.error.message);
    const mapped = mapXTweetList(page.data, username);
    await recordXRead({ posts: mapped.length });
    posts.push(...mapped.slice(0, count - posts.length));
    for (const tweet of page.data.data ?? []) initial.set(tweet.id, { mapped: mapXTweetMetrics(tweet), raw: tweet });
    paginationToken = page.data.meta?.next_token;
    if (!paginationToken || mapped.length === 0) break;
  }
  return { ok: true, data: { posts, initial, limitedBy } };
}

export async function importPosts(platform: ImportPlatform, requested: number): Promise<Result<ImportReport, ImportError>> {
  const count = Math.min(IMPORT_MAX_COUNT, Math.max(1, Math.floor(requested)));
  const connection = await prisma.socialConnection.findUnique({ where: { platform } });
  if (!connection) return fail("NOT_CONNECTED", "Hesap bağlı değil — Etkileşim & Reklam sayfasından bağlayın.");
  const token = await getAccessToken(connection);
  if (!token.ok) return fail("TOKEN", token.error);

  const fetched =
    platform === "X" ? await fetchX(token.data, connection.accountId, connection.accountName, count) : await fetchInstagram(token.data, connection.accountId, count);
  if (!fetched.ok) return fetched;

  const platformId = await prisma.$transaction((tx) => ensurePlatformRow(tx, platform));
  const ids = fetched.data.posts.map((post) => post.providerPostId);
  const existing = await prisma.socialPost.findMany({ where: { platformId, providerPostId: { in: ids } }, select: { providerPostId: true } });
  const plan = planImport(new Set(existing.flatMap((row) => (row.providerPostId ? [row.providerPostId] : []))), fetched.data.posts);

  const { count: created } = await prisma.socialPost.createMany({
    data: plan.toCreate.map((post) => ({
      platformId,
      source: "IMPORTED" as const,
      status: "PUBLISHED" as const,
      caption: post.caption,
      scheduledFor: post.publishedAt,
      publishedAt: post.publishedAt,
      providerPostId: post.providerPostId,
      permalink: post.permalink,
      mediaType: post.mediaType,
      thumbnailUrl: post.thumbnailUrl,
      mediaUrls: post.mediaUrls,
    })),
    skipDuplicates: true,
  });

  const createdIds = await recordInitialSnapshots(platformId, plan.toCreate, fetched.data.initial);
  const linked = await linkPublishedDrafts(platformId, ids);
  // Analiz özellikleri (metin/zaman; bağlanan taslaklarda içerik türü ve maç) — hata içe aktarmayı bozmaz.
  await computePostFeaturesSafe([...new Set([...createdIds, ...linked])]);
  const linkedDrafts = linked.length;
  return {
    ok: true,
    data: { platform, fetched: fetched.data.posts.length, created, skipped: plan.skipped + (plan.toCreate.length - created), linkedDrafts, limitedBy: fetched.data.limitedBy },
  };
}

/** Yeni eklenen gönderiler için içe aktarma anındaki sayaçlar ilk snapshot olur (ek istek yapılmaz). */
async function recordInitialSnapshots(platformId: string, created: readonly ImportedPost[], initial: Fetched["initial"]): Promise<string[]> {
  if (created.length === 0) return [];
  const rows = await prisma.socialPost.findMany({
    where: { platformId, providerPostId: { in: created.map((post) => post.providerPostId) } },
    select: { id: true, providerPostId: true, publishedAt: true, mediaType: true, platform: { select: { type: true } } },
  });
  const now = new Date();
  for (const row of rows) {
    const values = row.providerPostId ? initial.get(row.providerPostId) : undefined;
    if (!values || !row.providerPostId || !row.publishedAt) continue;
    const target = { id: row.id, platformType: row.platform.type, providerPostId: row.providerPostId, publishedAt: row.publishedAt, mediaType: row.mediaType, lastCapturedAt: null, lastCollectedAt: null };
    await writeSnapshot({ target, mapped: values.mapped, trigger: "IMPORT", checkpoint: null, raw: values.raw, now });
  }
  return rows.map((row) => row.id);
}

/**
 * Bu değişiklikten önce paylaşılmış (SocialPost'u olmayan) taslaklar: platform kimliği eşleşen gönderiye
 * bağlanır; gönderi panelden çıktığı için kaynağı PANEL, maçı taslağın maçı olur.
 */
async function linkPublishedDrafts(platformId: string, providerPostIds: string[]): Promise<string[]> {
  if (providerPostIds.length === 0) return [];
  const drafts = await prisma.aiContent.findMany({
    where: { status: "PUBLISHED", postId: null, publishedPostId: { in: providerPostIds } },
    select: { id: true, fixtureId: true, publishedPostId: true },
  });
  const linked: string[] = [];
  for (const draft of drafts) {
    if (!draft.publishedPostId) continue;
    const post = await prisma.socialPost.findUnique({ where: { platformId_providerPostId: { platformId, providerPostId: draft.publishedPostId } }, select: { id: true } });
    if (!post) continue;
    await prisma.$transaction([
      prisma.socialPost.update({ where: { id: post.id }, data: { source: "PANEL", fixtureId: draft.fixtureId } }),
      prisma.aiContent.update({ where: { id: draft.id }, data: { postId: post.id } }),
    ]);
    linked.push(post.id);
  }
  return linked;
}
