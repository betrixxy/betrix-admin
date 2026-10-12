import { env, socialUseMocks } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import type { SocialApiError } from "@/lib/services/social/client";
import { getAccessToken } from "@/lib/services/social/connections";
import { publishInstagram } from "@/lib/services/social/instagram";
import { publishTweet, type XMedia } from "@/lib/services/social/twitter";
import type { PublishPlatform, PublishTarget } from "@/types/publishing";
import type { Result } from "@/types/result";
import type { SocialPlatformType } from "@/types/social";

/**
 * Yayın Merkezi → sosyal hesap: bağlantı (SocialConnection, şifreli token), paylaşım izni ve mock modu burada
 * çözülür; çağıran kod platform API'sini bilmez (bkz. CLAUDE.md 1.4, 4.4). Mock modunda (SOCIAL_USE_MOCKS)
 * canlı ortamda paylaşım KAPALIDIR — sahte "yayınlandı" kaydı oluşmasın; geliştirmede simüle edilir.
 */

const CONNECTION: Record<PublishPlatform, SocialPlatformType> = { IG_POST: "META_INSTAGRAM", IG_REELS_STORY: "META_INSTAGRAM", X: "X" };
const REQUIRED_SCOPES: Record<SocialPlatformType, readonly string[]> = {
  META_INSTAGRAM: ["instagram_content_publish"],
  META_FACEBOOK: [],
  TIKTOK: [],
  YOUTUBE: [],
  X: ["tweet.write", "media.write"],
};
const ACCOUNT_LABEL: Record<SocialPlatformType, string> = { META_INSTAGRAM: "Instagram", META_FACEBOOK: "Facebook", TIKTOK: "TikTok", YOUTUBE: "YouTube", X: "X" };

const isProduction = env.NODE_ENV === "production";

export interface PublishMediaFile {
  /** X'e doğrudan yüklenir. */
  buffer: Buffer;
  mimeType: XMedia["mimeType"];
  /** Instagram'ın indireceği imzalı, herkese açık JPEG adresi. */
  publicUrl: string;
}

export interface PublishRequest {
  platform: PublishPlatform;
  caption: string;
  media: PublishMediaFile[];
}

const notConnected = (message: string): { ok: false; error: SocialApiError } => ({ ok: false, error: { code: "NOT_CONNECTED", message } });

/** Platform başına "Hemen Paylaş" durumu (arayüz için; token içermez). */
export async function getPublishTargets(): Promise<Record<PublishPlatform, PublishTarget>> {
  const connections = await prisma.socialConnection.findMany({ select: { platform: true, accountName: true, scopes: true } });
  const target = (platform: PublishPlatform): PublishTarget => {
    if (socialUseMocks && isProduction) return { available: false, reason: "SOCIAL_USE_MOCKS açık — canlıda gerçek paylaşım kapalı.", accountName: null };
    if (socialUseMocks) return { available: true, reason: null, accountName: "mock" };
    const type = CONNECTION[platform];
    const connection = connections.find((row) => row.platform === type);
    if (!connection) return { available: false, reason: `${ACCOUNT_LABEL[type]} hesabı bağlı değil — Etkileşim & Reklam sayfasından bağlayın.`, accountName: null };
    const missing = REQUIRED_SCOPES[type].filter((scope) => !connection.scopes.includes(scope));
    if (missing.length > 0) return { available: false, reason: `${ACCOUNT_LABEL[type]} bağlantısında paylaşım izni yok (${missing.join(", ")}) — hesabı yeniden bağlayın.`, accountName: connection.accountName };
    return { available: true, reason: null, accountName: connection.accountName };
  };
  return { IG_POST: target("IG_POST"), IG_REELS_STORY: target("IG_REELS_STORY"), X: target("X") };
}

/** Seçilen platforma paylaşır; başarılıysa platformun gönderi kimliği ve bağlantısı. */
export async function publishToPlatform(request: PublishRequest): Promise<Result<{ postId: string; url: string }, SocialApiError>> {
  if (socialUseMocks) {
    if (isProduction) return notConnected("SOCIAL_USE_MOCKS açık — canlıda gerçek paylaşım kapalı.");
    const postId = `mock-${Date.now()}`;
    return { ok: true, data: { postId, url: `https://example.com/mock/${request.platform.toLowerCase()}/${postId}` } };
  }

  const type = CONNECTION[request.platform];
  const connection = await prisma.socialConnection.findUnique({ where: { platform: type } });
  if (!connection) return notConnected(`${ACCOUNT_LABEL[type]} hesabı bağlı değil.`);
  const missing = REQUIRED_SCOPES[type].filter((scope) => !connection.scopes.includes(scope));
  if (missing.length > 0) return notConnected(`${ACCOUNT_LABEL[type]} bağlantısında paylaşım izni yok — hesabı yeniden bağlayın.`);
  const token = await getAccessToken(connection);
  if (!token.ok) return notConnected(token.error);

  if (request.platform === "X") {
    return publishTweet(
      token.data,
      request.caption,
      request.media.map(({ buffer, mimeType }) => ({ buffer, mimeType })),
    );
  }
  return publishInstagram({
    accessToken: token.data,
    igUserId: connection.accountId,
    username: connection.accountName,
    caption: request.caption,
    imageUrls: request.media.map((item) => item.publicUrl),
    kind: request.platform === "IG_REELS_STORY" ? "story" : "feed",
  });
}
