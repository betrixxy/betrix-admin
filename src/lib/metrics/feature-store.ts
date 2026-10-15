import { istanbulDay } from "@/lib/metrics/istanbul-time";
import {
  captionFeatures,
  derbyIntensityOf,
  FEATURE_VERSION,
  formatRatio,
  isDerbyIntensity,
  linkPlacementOf,
  nearestFollowerCount,
  templateNameOf,
  timeFeatures,
} from "@/lib/metrics/post-features";
import { prisma } from "@/lib/prisma";
import { getFixtureById, parseFixtureId } from "@/lib/services/api-football";
import type { SocialPlatformType } from "@/types/social";
import type { Fixture } from "@/types/sports";

/**
 * `PostFeatures` yazımının tek noktası. Yayın Merkezi paylaşımından hemen sonra ve içe aktarmada çağrılır;
 * hata paylaşımı/içe aktarmayı asla bozmaz (yalnızca loglanır). Maç bilgisi API-Football'dan (önbellekli),
 * paylaşım anındaki takipçi en yakın `AccountMetricSnapshot`'tan okunur.
 */

const FOLLOWER_LOOKUP_DAYS = 7;

async function fixtureOf(fixtureId: string | null): Promise<Fixture | null> {
  const apiId = fixtureId ? parseFixtureId(fixtureId) : null;
  if (apiId === null) return null;
  const result = await getFixtureById(apiId);
  return result.ok ? result.data : null;
}

async function followersAt(platform: SocialPlatformType, publishedAt: Date): Promise<number | null> {
  const span = FOLLOWER_LOOKUP_DAYS * 86_400_000;
  const rows = await prisma.accountMetricSnapshot.findMany({
    where: { platform, date: { gte: new Date(publishedAt.getTime() - span), lte: new Date(publishedAt.getTime() + span) } },
    select: { date: true, followerCount: true },
  });
  return nearestFollowerCount(
    rows.map((row) => ({ day: row.date.toISOString().slice(0, 10), followerCount: row.followerCount })),
    istanbulDay(publishedAt),
  );
}

export async function computePostFeatures(socialPostId: string): Promise<void> {
  const post = await prisma.socialPost.findUnique({
    where: { id: socialPostId },
    select: {
      id: true,
      caption: true,
      publishedAt: true,
      scheduledFor: true,
      fixtureId: true,
      mediaUrls: true,
      platform: { select: { type: true } },
      aiContents: { select: { contentType: true, format: true, renderOptions: true }, orderBy: { updatedAt: "desc" }, take: 1 },
    },
  });
  if (!post) return;
  const publishedAt = post.publishedAt ?? post.scheduledFor;
  const content = post.aiContents[0] ?? null;
  const fixture = await fixtureOf(post.fixtureId);
  const caption = captionFeatures(post.caption);
  const derbyIntensity = derbyIntensityOf(content?.renderOptions) ?? fixture?.derbyIntensity ?? null;

  const data = {
    featureVersion: FEATURE_VERSION,
    computedAt: new Date(),
    ...timeFeatures(publishedAt, fixture ? new Date(fixture.kickoffUtc) : null),
    contentType: content?.contentType ?? null,
    format: formatRatio(content?.format ?? null),
    templateName: templateNameOf(content?.renderOptions),
    mediaCount: post.mediaUrls.length,
    ...caption,
    linkPlacement: linkPlacementOf(caption),
    league: fixture?.competition.name ?? null,
    homeTeam: fixture?.homeTeam.name ?? null,
    awayTeam: fixture?.awayTeam.name ?? null,
    isDerby: isDerbyIntensity(derbyIntensity),
    derbyIntensity,
    followersAtPublish: await followersAt(post.platform.type, publishedAt),
  };
  await prisma.postFeatures.upsert({ where: { socialPostId }, update: data, create: { socialPostId, ...data } });
}

/** Hata yutan sarmalayıcı — paylaşım/içe aktarma akışında kullanılır. */
export async function computePostFeaturesSafe(socialPostIds: readonly string[]): Promise<void> {
  for (const id of socialPostIds) {
    try {
      await computePostFeatures(id);
    } catch (error) {
      console.warn(`[features] ${id} hesaplanamadı: ${error instanceof Error ? error.message : "bilinmeyen hata"}`);
    }
  }
}
