import { createHash, createHmac } from "node:crypto";
import { env } from "@/lib/env";

/**
 * IP adresinin HMAC-SHA256 özeti (hex) — ham IP hiçbir tabloya yazılmaz ve loglanmaz (bkz. CLAUDE.md 4.3).
 * Anahtar sabittir (`IP_HASH_SECRET`): aynı IP her zaman aynı özeti verir, geri dönen ziyaretçi ölçülebilir.
 * Migration'daki pgcrypto `hmac(ip, secret, 'sha256')` ile birebir aynı sonucu üretir.
 */

export function hashIpWith(secret: string, ip: string): string {
  return createHmac("sha256", secret).update(ip.trim()).digest("hex");
}

function secret(): string {
  if (env.IP_HASH_SECRET) return env.IP_HASH_SECRET;
  // Yalnızca geliştirme: anahtar yoksa JWT_SECRET'tan türetilir (üretimde compose IP_HASH_SECRET'ı zorunlu kılar).
  return createHash("sha256").update(`ip-hash:${env.JWT_SECRET}`).digest("hex");
}

export function hashIp(ip: string | null): string | null {
  return ip ? hashIpWith(secret(), ip) : null;
}
