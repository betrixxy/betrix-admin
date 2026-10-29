/**
 * Deploy öncesi kaydedilen konteyner günlüklerinin sır taraması (saf). İki katman:
 * (1) `.env.production`'daki sır anahtarlarının DEĞERLERİ (anahtar adı sır kalıbına uyuyorsa) günlükte
 *     geçiyorsa `[GİZLİ:<ANAHTAR>]` ile değişir;
 * (2) değeri bilinmeyen sır kalıpları: bağlantı adresindeki şifre, Bearer/JWT, oturum çerezi, URL'deki
 *     anahtar/token parametresi.
 * Sonuç yalnızca sayıları taşır — değerler hiçbir çıktıya yazılmaz.
 */

const SECRET_KEY = /SECRET|KEY|TOKEN|PASSWORD|PASSWD|DATABASE_URL|CREDENTIAL|PRIVATE/i;
/** Kısa değerler (ör. "true", "8") her yerde geçer; sır sayılmaz. */
const MIN_SECRET_LENGTH = 8;

const PATTERNS: { label: string; re: RegExp; replace: string }[] = [
  { label: "bağlantı şifresi", re: /\b([a-z][a-z0-9+.-]*:\/\/[^:\s/@]+:)[^@\s]+@/giu, replace: "$1[GİZLİ]@" },
  { label: "Bearer", re: /\b(Bearer\s+)[A-Za-z0-9._~+/=-]{12,}/gu, replace: "$1[GİZLİ]" },
  { label: "JWT", re: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/gu, replace: "[GİZLİ:JWT]" },
  { label: "oturum çerezi", re: /(checkmatch_session=)[^;\s"]+/gu, replace: "$1[GİZLİ]" },
  { label: "URL anahtarı", re: /([?&](?:api_?key|key|token|access_token|secret|password|sig|signature)=)[^&\s"]+/giu, replace: "$1[GİZLİ]" },
];

/** `.env` biçimi → sır sayılan değerler (anahtar adıyla). Yorum/boş satır, tırnak desteklenir. */
export function secretValues(envText: string): { key: string; value: string }[] {
  return envText
    .split(/\r?\n/u)
    .map((line) => /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/u.exec(line))
    .flatMap((match) => {
      if (!match?.[1]) return [];
      const value = (match[2] ?? "").trim().replace(/^(['"])(.*)\1$/u, "$2");
      return SECRET_KEY.test(match[1]) && value.length >= MIN_SECRET_LENGTH ? [{ key: match[1], value }] : [];
    })
    // Uzun değer önce: biri ötekini içeriyorsa (DATABASE_URL ⊃ POSTGRES_PASSWORD) uzunu tek parça maskelenir.
    .sort((a, b) => b.value.length - a.value.length);
}

export interface RedactionResult {
  text: string;
  /** Bilinen sır değerinden maskelenen geçiş sayısı (anahtar başına). */
  envHits: Record<string, number>;
  patternHits: Record<string, number>;
}

export function redactLog(text: string, secrets: { key: string; value: string }[]): RedactionResult {
  let out = text;
  const envHits: Record<string, number> = {};
  for (const { key, value } of secrets) {
    const parts = out.split(value);
    if (parts.length > 1) {
      envHits[key] = (envHits[key] ?? 0) + parts.length - 1;
      out = parts.join(`[GİZLİ:${key}]`);
    }
  }
  const patternHits: Record<string, number> = {};
  for (const { label, re, replace } of PATTERNS) {
    out = out.replace(re, (...args: unknown[]) => {
      patternHits[label] = (patternHits[label] ?? 0) + 1;
      const groups = args.slice(1, -2).map((group) => (typeof group === "string" ? group : ""));
      return replace.replace(/\$(\d)/gu, (_m, index: string) => groups[Number(index) - 1] ?? "");
    });
  }
  return { text: out, envHits, patternHits };
}

/** Kaç gün eski günlük silinir. */
export const LOG_RETENTION_DAYS = 30;

export function isExpired(mtimeMs: number, nowMs: number, days = LOG_RETENTION_DAYS): boolean {
  return nowMs - mtimeMs > days * 24 * 60 * 60 * 1000;
}
