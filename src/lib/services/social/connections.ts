import type { SocialConnection } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { refreshAccessToken, type ConnectResult } from "@/lib/services/social/adapter";
import { PLATFORM_TO_SLUG, SLUG_TO_PLATFORM } from "@/lib/services/social/platforms";
import { decryptToken, encryptToken } from "@/lib/services/social/token-crypto";
import type { Result } from "@/types/result";
import type { SocialPlatformType } from "@/types/social";
import type { OAuthTokenSet, PlatformSlug, SocialConnectionView } from "@/types/social-connection";

/**
 * `SocialConnection` tablosunun tek erişim noktası. Token'lar yalnızca burada şifrelenir/çözülür;
 * dışarıya çözülmüş token yalnızca `getAccessToken()` ile, anlık kullanım için verilir.
 */

/** Süresi bu kadar içinde dolacak token senkronizasyondan önce yenilenir. */
const REFRESH_LEEWAY_MS = 5 * 60 * 1000;

function encryptTokenSet(tokens: OAuthTokenSet): Result<{ accessToken: string; refreshToken: string | null }, string> {
  const access = encryptToken(tokens.accessToken);
  if (!access.ok) return { ok: false, error: access.error.message };
  if (!tokens.refreshToken) return { ok: true, data: { accessToken: access.data, refreshToken: null } };
  const refresh = encryptToken(tokens.refreshToken);
  if (!refresh.ok) return { ok: false, error: refresh.error.message };
  return { ok: true, data: { accessToken: access.data, refreshToken: refresh.data } };
}

export async function saveConnection(slug: PlatformSlug, result: ConnectResult): Promise<Result<void, string>> {
  const encrypted = encryptTokenSet(result.tokens);
  if (!encrypted.ok) return encrypted;

  const platform = SLUG_TO_PLATFORM[slug];
  const fields = {
    accountId: result.account.accountId,
    accountName: result.account.accountName,
    accessToken: encrypted.data.accessToken,
    refreshToken: encrypted.data.refreshToken,
    expiresAt: result.tokens.expiresAt,
    scopes: result.tokens.scopes,
    lastSyncError: null,
  };
  // Aynı platform yeniden bağlanırsa eski hesap/token'ların üzerine yazılır.
  await prisma.socialConnection.upsert({
    where: { platform },
    update: { ...fields, connectedAt: new Date() },
    create: { platform, ...fields },
  });
  return { ok: true, data: undefined };
}

/**
 * Bağlantıyı koparır: şifreli token'lar veritabanından silinir. Sağlayıcı tarafında izni
 * kaldırmak (revoke) platform panelinden de yapılabilir; gerçek revoke çağrısı gerçek API
 * adaptörleriyle birlikte eklenecek. Mevcut `PostAnalytics` verisi korunur.
 */
export async function deleteConnection(platform: SocialPlatformType): Promise<boolean> {
  const { count } = await prisma.socialConnection.deleteMany({ where: { platform } });
  return count > 0;
}

export function toConnectionView(row: SocialConnection): SocialConnectionView {
  return {
    platform: row.platform,
    slug: PLATFORM_TO_SLUG[row.platform],
    accountId: row.accountId,
    accountName: row.accountName,
    connectedAt: row.connectedAt.toISOString(),
    expiresAt: row.expiresAt?.toISOString() ?? null,
    lastSyncedAt: row.lastSyncedAt?.toISOString() ?? null,
    lastSyncError: row.lastSyncError,
  };
}

export function listConnections(): Promise<SocialConnection[]> {
  return prisma.socialConnection.findMany();
}

/** Geçerli (gerekirse yenilenmiş) düz access token. Yenilenen token hemen şifreli yazılır. */
export async function getAccessToken(row: SocialConnection): Promise<Result<string, string>> {
  const expiresSoon = row.expiresAt !== null && row.expiresAt.getTime() - Date.now() < REFRESH_LEEWAY_MS;
  if (!expiresSoon) {
    const access = decryptToken(row.accessToken);
    return access.ok ? access : { ok: false, error: access.error.message };
  }

  if (!row.refreshToken) {
    return { ok: false, error: "Token süresi doldu ve yenileme token'ı yok — hesabı yeniden bağlayın." };
  }
  const refresh = decryptToken(row.refreshToken);
  if (!refresh.ok) return { ok: false, error: refresh.error.message };

  const refreshed = await refreshAccessToken(PLATFORM_TO_SLUG[row.platform], refresh.data);
  if (!refreshed.ok) return { ok: false, error: `Token yenilenemedi: ${refreshed.error.message}` };

  const encrypted = encryptTokenSet(refreshed.data);
  if (!encrypted.ok) return encrypted;
  await prisma.socialConnection.update({
    where: { id: row.id },
    data: {
      accessToken: encrypted.data.accessToken,
      refreshToken: encrypted.data.refreshToken,
      expiresAt: refreshed.data.expiresAt,
    },
  });
  return { ok: true, data: refreshed.data.accessToken };
}

export async function recordSyncOutcome(platform: SocialPlatformType, error: string | null): Promise<void> {
  await prisma.socialConnection.update({
    where: { platform },
    data: error ? { lastSyncError: error.slice(0, 500) } : { lastSyncError: null, lastSyncedAt: new Date() },
  });
}
