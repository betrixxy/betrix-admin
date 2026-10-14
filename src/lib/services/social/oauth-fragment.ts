/**
 * Bazı sağlayıcı yapılandırmalarında (gözlemlenen: Meta) yetkilendirme yanıtı (`code`, `state`, `error`)
 * sorgu yerine URL fragment'ında (`#…`) döner; tarayıcı fragment'ı sunucuya hiç göndermez. Callback böyle
 * boş bir istek aldığında bu küçük sayfayı döner: fragment'taki parametreleri aynı callback'e sorgu olarak
 * yeniden gönderir. `FRAGMENT_MARKER` döngüyü keser — ikinci istekte hâlâ parametre yoksa normal akış
 * `invalid_state` ile sonuçlanır. State doğrulaması aynen sunucuda yapılır; sayfa yalnızca taşıyıcıdır.
 */

export const FRAGMENT_MARKER = "from_fragment";

/** Meta bazı hatalarda `error` yerine yalnızca `error_code` + `error_message` döner (state olmadan da). */
const RESPONSE_PARAMS = ["code", "state", "error", "error_code"] as const;

const PROVIDER_ERROR_PARAMS = ["error", "error_reason", "error_code", "error_message"] as const;
const PROVIDER_ERROR_VALUE_MAX = 300;

/** Sorguda ne yetkilendirme yanıtı ne de işaret varsa yanıt fragment'ta olabilir. */
export function needsFragmentBounce(query: URLSearchParams): boolean {
  return !query.has(FRAGMENT_MARKER) && RESPONSE_PARAMS.every((name) => !query.has(name));
}

/** Sağlayıcı bir hata döndürdü mü (OAuth `error` ya da Meta `error_code`)? */
export function hasProviderError(query: URLSearchParams): boolean {
  return query.has("error") || query.has("error_code");
}

/** Kullanıcı onay ekranında iptal etti mi — diğer sağlayıcı hataları yapılandırma sorunudur. */
export function isUserDenial(query: URLSearchParams): boolean {
  return query.get("error") === "access_denied" || query.get("error_reason") === "user_denied";
}

/**
 * Log satırı: sağlayıcının hata parametreleri. Değerler URL'den geldiği için (dışarıdan kontrol edilebilir)
 * boşluklar tekleştirilir, 300 karakterle sınırlanır ve tırnaklanır — log satırı bölünemez.
 */
export function describeProviderError(query: URLSearchParams): string {
  return PROVIDER_ERROR_PARAMS.map((name) => {
    const value = query.get(name);
    return `${name}=${value === null ? "-" : JSON.stringify(value.replace(/\s+/g, " ").slice(0, PROVIDER_ERROR_VALUE_MAX))}`;
  }).join(" ");
}

export function fragmentBounceResponse(): Response {
  const script = `(function(){var h=new URLSearchParams(location.hash.slice(1));h.delete("_");h.set(${JSON.stringify(FRAGMENT_MARKER)},"1");location.replace(location.pathname+"?"+h.toString());})();`;
  const html = `<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>Yönlendiriliyor…</title></head><body><script>${script}</script><noscript>JavaScript gerekli.</noscript></body></html>`;
  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "Content-Security-Policy": "default-src 'none'; script-src 'unsafe-inline'",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
