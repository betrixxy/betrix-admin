import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";
import { isSafeFileName, parseStoredFileUrl, type StorageBucket } from "@/lib/dashboard/storage";

/**
 * İmzalı, kısa ömürlü genel medya bağlantısı — Instagram Graph API görseli `image_url`'den kendisi
 * indirdiği için yalnızca paylaşım anında, tek dosya için üretilir. Diğer tüm dosyalar oturum korumalı
 * kalır (`/api/files`). İmza: HMAC-SHA256(`<kova>/<dosya>.<bitiş>`), anahtar JWT_SECRET'tan türetilir
 * (ayrı amaç etiketiyle — oturum imzasıyla karıştırılamaz).
 */

/** Meta görseli container oluşturulurken ve işlerken indirir; carousel'de 10 görsel ~birkaç dakika sürebilir. */
export const PUBLIC_MEDIA_TTL_MS = 15 * 60 * 1000;
/** Yalnızca çizilmiş kartlar ve AI üretimleri paylaşılabilir; yüklemeler ve kütüphane asla. */
const PUBLIC_BUCKETS: readonly StorageBucket[] = ["renders", "generated"];

function signingKey(): Buffer {
  return createHmac("sha256", env.JWT_SECRET).update("betrix:public-media:v1").digest();
}

function signature(target: string, expiresAt: number): string {
  return createHmac("sha256", signingKey()).update(`${target}.${expiresAt}`).digest("base64url");
}

/** `/api/files/<kova>/<dosya>` → mutlak, imzalı `APP_BASE_URL/api/public-media?f=&e=&s=`; paylaşılamayan dosyada null. */
export function signPublicMediaUrl(fileUrl: string, now: number = Date.now()): string | null {
  const stored = parseStoredFileUrl(fileUrl);
  if (!stored || !PUBLIC_BUCKETS.includes(stored.bucket)) return null;
  const target = `${stored.bucket}/${stored.fileName}`;
  const expiresAt = now + PUBLIC_MEDIA_TTL_MS;
  const url = new URL("/api/public-media", env.APP_BASE_URL);
  url.search = new URLSearchParams({ f: target, e: String(expiresAt), s: signature(target, expiresAt) }).toString();
  return url.toString();
}

/** İmza, süre ve kova denetimi; geçerliyse servis edilecek dosya. */
export function verifyPublicMedia(target: string | null, expires: string | null, sig: string | null, now: number = Date.now()): { bucket: StorageBucket; fileName: string } | null {
  if (!target || !expires || !sig || !/^\d{1,16}$/.test(expires)) return null;
  const expiresAt = Number(expires);
  // Süresi dolmuş ya da TTL'den uzun (elle üretilmiş) bağlantı reddedilir.
  if (expiresAt < now || expiresAt > now + PUBLIC_MEDIA_TTL_MS) return null;
  const expected = Buffer.from(signature(target, expiresAt));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  const [bucket, fileName, ...rest] = target.split("/");
  if (rest.length > 0 || !bucket || !fileName || !isSafeFileName(fileName)) return null;
  const stored = parseStoredFileUrl(`/api/files/${bucket}/${fileName}`);
  return stored && PUBLIC_BUCKETS.includes(stored.bucket) ? stored : null;
}
