import type { Prisma } from "@/generated/prisma/client";
import { canReuseLinkedPost, publishedMediaType, PUBLISH_TO_PLATFORM_TYPE } from "@/lib/dashboard/post-source";
import { PLATFORM_LABELS } from "@/lib/dashboard/social-meta";
import type { PublishedInfo, PublishSettings } from "@/types/publishing";
import type { SocialPlatformType } from "@/types/social";

/**
 * SocialPost kaydının tek yazım noktası (gönderilerin tek doğruluk kaynağı — bkz. CLAUDE.md 4.4).
 * Yayın Merkezi'nden yapılan HER başarılı paylaşım koşulsuz bir SocialPost'a dönüşür; taslak daha
 * önce takvimdeki uygun bir gönderiye bağlıysa o kayıt "Paylaşıldı" yapılır, değilse yenisi açılır.
 */

type Tx = Prisma.TransactionClient;

/** Platform kaydı ilk kullanımda oluşturulur — ayrıca seed gerekmez. */
export async function ensurePlatformRow(tx: Tx, type: SocialPlatformType): Promise<string> {
  const row = await tx.socialPlatform.upsert({ where: { type }, update: {}, create: { type, displayName: PLATFORM_LABELS[type] } });
  return row.id;
}

export interface PanelPublishInput {
  aiContentId: string;
  /** Taslağın önceden bağlı olduğu takvim gönderisi. */
  linkedPostId: string | null;
  fixtureId: string;
  published: PublishedInfo;
  settings: PublishSettings;
  caption: string;
}

/** Paylaşımı SocialPost olarak kaydeder ve taslağı ona bağlar; gönderi kimliğini döner. */
export async function recordPanelPublish(tx: Tx, input: PanelPublishInput): Promise<string> {
  const { published, settings } = input;
  const platformType = PUBLISH_TO_PLATFORM_TYPE[published.platform];
  const platformId = await ensurePlatformRow(tx, platformType);
  const publishedAt = new Date(published.at);
  const mediaUrls = settings.layout === "single" ? settings.mediaOrder.slice(0, 1) : settings.mediaOrder;

  const fields = {
    caption: input.caption,
    scheduledFor: publishedAt,
    publishedAt,
    status: "PUBLISHED" as const,
    providerPostId: published.postId,
    permalink: published.url,
    mediaType: publishedMediaType(published.platform, settings.layout, mediaUrls.length),
    thumbnailUrl: mediaUrls[0] ?? null,
    mediaUrls,
  };

  const linked = input.linkedPostId
    ? await tx.socialPost.findUnique({ where: { id: input.linkedPostId }, select: { id: true, providerPostId: true, platform: { select: { type: true } } } })
    : null;

  let postId: string;
  if (linked && canReuseLinkedPost({ platformType: linked.platform.type, providerPostId: linked.providerPostId }, platformType)) {
    postId = (await tx.socialPost.update({ where: { id: linked.id }, data: fields, select: { id: true } })).id;
  } else {
    // Aynı platform gönderisi zaten kayıtlıysa (ör. önce içe aktarıldı) onun üzerine yazılır.
    const row = await tx.socialPost.upsert({
      where: { platformId_providerPostId: { platformId, providerPostId: published.postId } },
      update: { ...fields, source: "PANEL", fixtureId: input.fixtureId },
      create: { ...fields, source: "PANEL", fixtureId: input.fixtureId, platformId },
      select: { id: true },
    });
    postId = row.id;
  }

  await tx.aiContent.update({ where: { id: input.aiContentId }, data: { postId } });
  return postId;
}
