import type { SocialConnection } from "@/generated/prisma/client";
import { socialUseMocks } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { fetchPostMetrics } from "@/lib/services/social/adapter";
import { getAccessToken, listConnections, recordSyncOutcome } from "@/lib/services/social/connections";
import { isSyncDue } from "@/lib/services/social/metrics/schedule";
import type { PostMetricsSnapshot, SyncReport } from "@/types/social-connection";

/**
 * Veri çekme motoru (Data Ingestion): bağlı her hesabın token'ıyla, o platformdaki yayınlanmış
 * gönderilerin güncel metriklerini çekip `PostAnalytics`'e yazar.
 *
 * Akış: SocialConnection → (gerekirse token yenile) → yayınlanmış SocialPost'lar →
 *       kademeli takvime göre zamanı gelenler → adapter (mock | gerçek API) → ham yanıt
 *       → zod şeması → kanonik PostMetricsSnapshot → PostAnalytics upsert.
 *
 * Tetikleme bilinçli olarak manueldir (Etkileşim panelindeki "Senkronize et" düğmesi) — cron/
 * worker eklenmedi (bkz. CLAUDE.md 1.10). Zamanlayıcı eklenirse yalnızca `syncSocialMetrics()`'i
 * çağırması yeterlidir.
 */

export interface SyncOptions {
  /** Kademeli takvimi yok sayıp tüm yayınlanmış gönderileri çeker. */
  force?: boolean;
}

/** Aynı süreçte eşzamanlı iki senkronizasyon aynı gönderileri iki kez çekmesin. */
let inFlight: Promise<SyncReport> | null = null;

export function syncSocialMetrics(options: SyncOptions = {}): Promise<SyncReport> {
  inFlight ??= runSync(options).finally(() => {
    inFlight = null;
  });
  return inFlight;
}

async function runSync(options: SyncOptions): Promise<SyncReport> {
  const report: SyncReport = { updated: 0, skipped: 0, failures: [] };
  const connections = await listConnections();

  // Platformlar sırayla işlenir — her sağlayıcının hız limitine tek tek, öngörülebilir yük bindirilir.
  for (const connection of connections) {
    const outcome = await syncConnection(connection, options);
    report.updated += outcome.updated;
    report.skipped += outcome.skipped;
    if (outcome.error) report.failures.push({ platform: connection.platform, message: outcome.error });
    await recordSyncOutcome(connection.platform, outcome.error);
  }

  return report;
}

interface ConnectionOutcome {
  updated: number;
  skipped: number;
  error: string | null;
}

async function syncConnection(connection: SocialConnection, options: SyncOptions): Promise<ConnectionOutcome> {
  const outcome: ConnectionOutcome = { updated: 0, skipped: 0, error: null };

  const token = await getAccessToken(connection);
  if (!token.ok) return { ...outcome, error: token.error };

  const posts = await prisma.socialPost.findMany({
    where: {
      status: "PUBLISHED",
      publishedAt: { not: null },
      platform: { type: connection.platform },
      // Gerçek modda platform kimliği olmayan gönderi çekilemez.
      ...(socialUseMocks ? {} : { providerPostId: { not: null } }),
    },
    select: { id: true, providerPostId: true, publishedAt: true, analytics: { select: { source: true, lastSyncedAt: true } } },
  });

  for (const post of posts) {
    if (!post.publishedAt) continue;
    // Mock veri elle girilmiş gerçek metriklerin üzerine asla yazılmaz.
    const protectedManual = socialUseMocks && post.analytics?.source === "MANUAL";
    const due = options.force || isSyncDue(post.publishedAt, post.analytics?.lastSyncedAt ?? null);
    if (protectedManual || !due) {
      outcome.skipped += 1;
      continue;
    }

    const metrics = await fetchPostMetrics({
      platform: connection.platform,
      accessToken: token.data,
      accountId: connection.accountId,
      providerPostId: post.providerPostId ?? `mock-${post.id}`,
      publishedAt: post.publishedAt,
    });
    if (!metrics.ok) {
      // İlk hata raporlanır; token/yetki sorunlarında kalan gönderiler de aynı hatayı verir.
      outcome.error ??= metrics.error.message;
      if (metrics.error.code === "NOT_IMPLEMENTED") break;
      continue;
    }

    await writePostAnalytics(post.id, metrics.data);
    outcome.updated += 1;
  }

  return outcome;
}

async function writePostAnalytics(postId: string, snapshot: PostMetricsSnapshot): Promise<void> {
  const data = {
    likes: snapshot.likes,
    comments: snapshot.comments,
    shares: snapshot.shares,
    saves: snapshot.saves,
    views: snapshot.views,
    reach: snapshot.reach,
    impressions: snapshot.impressions,
    watchTimeSeconds: snapshot.watchTimeSeconds,
    source: socialUseMocks ? ("MOCK" as const) : ("API" as const),
    lastSyncedAt: new Date(),
  };
  await prisma.postAnalytics.upsert({ where: { postId }, update: data, create: { postId, ...data } });
}
