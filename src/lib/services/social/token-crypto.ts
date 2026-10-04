import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";
import { env } from "@/lib/env";
import type { Result } from "@/types/result";

/**
 * OAuth token'larının veritabanında şifreli saklanması (AES-256-GCM). Biçim:
 * `v1.<iv>.<authTag>.<ciphertext>` (base64url). Anahtar `SOCIAL_TOKEN_ENCRYPTION_KEY`'dir;
 * yalnızca geliştirmede, tanımsızsa `JWT_SECRET`'tan HKDF ile türetilir. Üretimde anahtar
 * yoksa şifreleme reddedilir — bağlantı kurulmaz, token düz metin yazılmaz.
 */

const VERSION = "v1";
const IV_BYTES = 12;

export type TokenCryptoError = { code: "KEY_UNAVAILABLE" | "DECRYPT_FAILED"; message: string };

function resolveKey(): Buffer | null {
  if (env.SOCIAL_TOKEN_ENCRYPTION_KEY) return Buffer.from(env.SOCIAL_TOKEN_ENCRYPTION_KEY, "hex");
  if (env.NODE_ENV === "production") return null;
  return Buffer.from(hkdfSync("sha256", env.JWT_SECRET, "betrix-social-tokens", "dev-fallback", 32));
}

export function isTokenEncryptionAvailable(): boolean {
  return resolveKey() !== null;
}

export function encryptToken(plaintext: string): Result<string, TokenCryptoError> {
  const key = resolveKey();
  if (!key) {
    return { ok: false, error: { code: "KEY_UNAVAILABLE", message: "SOCIAL_TOKEN_ENCRYPTION_KEY tanımlı değil." } };
  }
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const parts = [iv, cipher.getAuthTag(), ciphertext].map((part) => part.toString("base64url"));
  return { ok: true, data: [VERSION, ...parts].join(".") };
}

export function decryptToken(encoded: string): Result<string, TokenCryptoError> {
  const key = resolveKey();
  if (!key) {
    return { ok: false, error: { code: "KEY_UNAVAILABLE", message: "SOCIAL_TOKEN_ENCRYPTION_KEY tanımlı değil." } };
  }
  const [version, iv, tag, ciphertext] = encoded.split(".");
  if (version !== VERSION || !iv || !tag || !ciphertext) {
    return { ok: false, error: { code: "DECRYPT_FAILED", message: "Token biçimi tanınmadı." } };
  }
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64url"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(ciphertext, "base64url")),
      decipher.final(),
    ]).toString("utf8");
    return { ok: true, data: plaintext };
  } catch {
    // Anahtar değişmiş veya veri bozulmuş — bağlantı yeniden kurulmalı.
    return { ok: false, error: { code: "DECRYPT_FAILED", message: "Token çözülemedi — hesabı yeniden bağlayın." } };
  }
}
