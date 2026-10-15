import { randomBytes } from "node:crypto";

/** Kısa link kodu ve adresi — saf yardımcılar (bkz. CLAUDE.md 4.3). */

const ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
export const SHORT_CODE_LENGTH = 7;
export const SHORT_CODE_PATTERN = /^[0-9A-Za-z]{7}$/;

/** 62^7 ≈ 3.5 × 10^12 olasılık; çakışma veritabanı unique kısıtıyla yakalanıp yeniden denenir. */
export function generateShortCode(random: (size: number) => Buffer = randomBytes): string {
  let code = "";
  while (code.length < SHORT_CODE_LENGTH) {
    for (const byte of random(16)) {
      // 62'nin katı olmayan üst aralık atılır — dağılım eşit kalsın.
      if (byte < 248 && code.length < SHORT_CODE_LENGTH) code += ALPHABET[byte % 62];
    }
  }
  return code;
}

export function shortLinkUrl(baseUrl: string, code: string): string {
  return new URL(`/r/${code}`, baseUrl).toString();
}

const BOT_UA = /bot|crawl|spider|slurp|facebookexternalhit|facebot|twitterbot|whatsapp|telegram|discord|slack|skype|preview|embed|curl|wget|python|go-http|java\/|okhttp|headless|lighthouse|monitor/i;

/** Kaba bot filtresi: önizleme tarayıcıları ve otomasyon araçları — tıklama kaydedilir ama sayılmaz. */
export function isLikelyBot(userAgent: string | null): boolean {
  return !userAgent || userAgent.length < 10 || BOT_UA.test(userAgent);
}

export function referrerHostOf(referrer: string | null): string | null {
  if (!referrer) return null;
  try {
    return new URL(referrer).hostname.slice(0, 200) || null;
  } catch {
    return null;
  }
}
