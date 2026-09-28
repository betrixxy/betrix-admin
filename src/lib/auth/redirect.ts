export const DEFAULT_REDIRECT = "/dashboard";

/** Göreli yolu çözmek için sahte köken — yalnızca "hâlâ aynı kökende mi" kontrolü için kullanılır. */
const INTERNAL_ORIGIN = "http://betrix.internal";

/** Ters bölü ve ASCII kontrol karakterleri (tab, satır sonu, NUL, DEL). */
const UNSAFE_CHARS = /[\\\u0000-\u001f\u007f]/;

/**
 * Açık yönlendirme (open redirect) saldırılarına karşı yalnızca site-içi göreli yollara izin verir.
 * Tarayıcılar `\` karakterini `/` sayar ve tab/satır sonlarını URL'den atar; bu yüzden
 * `/\evil.com` veya `/\t/evil.com` gibi girdiler `//evil.com`'a dönüşür. Bu karakterleri içeren
 * her hedef reddedilir, kalan yol URL olarak çözülüp kökenin değişmediği doğrulanır.
 */
export function resolveRedirectTarget(target: string | undefined | null): string {
  if (!target || !target.startsWith("/") || target.startsWith("//")) return DEFAULT_REDIRECT;
  if (UNSAFE_CHARS.test(target)) return DEFAULT_REDIRECT;

  try {
    const url = new URL(target, INTERNAL_ORIGIN);
    if (url.origin !== INTERNAL_ORIGIN) return DEFAULT_REDIRECT;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return DEFAULT_REDIRECT;
  }
}
