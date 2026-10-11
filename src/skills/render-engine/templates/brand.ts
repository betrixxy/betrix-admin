/**
 * Render motorunun marka logosu — tek kaynak. Kartlarda yalnızca "CheckMatch" yazan logo kullanılır,
 * ".net" uzantılı logo hiçbir şablonda çizilmez (marka kuralı). Dosyayı `lib/dashboard/match-day-assets.ts`
 * okur; şablonlar genişliği bu orandan hesaplar ki logo esnemesin.
 */

/** `public/` altındaki dosya — 1269×248, şeffaf PNG. */
export const BRAND_LOGO_FILE = "brand/checkmatch-logo.png";
export const BRAND_LOGO_RATIO = 1269 / 248;
export const BRAND_LOGO_ALT = "CheckMatch";

/** Verilen yükseklik için logonun genişliği (oran korunur). */
export function brandLogoWidth(height: number): number {
  return Math.round(height * BRAND_LOGO_RATIO);
}
