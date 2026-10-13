/**
 * Bazı sağlayıcı yapılandırmalarında (gözlemlenen: Meta) yetkilendirme yanıtı (`code`, `state`, `error`)
 * sorgu yerine URL fragment'ında (`#…`) döner; tarayıcı fragment'ı sunucuya hiç göndermez. Callback böyle
 * boş bir istek aldığında bu küçük sayfayı döner: fragment'taki parametreleri aynı callback'e sorgu olarak
 * yeniden gönderir. `FRAGMENT_MARKER` döngüyü keser — ikinci istekte hâlâ parametre yoksa normal akış
 * `invalid_state` ile sonuçlanır. State doğrulaması aynen sunucuda yapılır; sayfa yalnızca taşıyıcıdır.
 */

export const FRAGMENT_MARKER = "from_fragment";

const RESPONSE_PARAMS = ["code", "state", "error"] as const;

/** Sorguda ne yetkilendirme yanıtı ne de işaret varsa yanıt fragment'ta olabilir. */
export function needsFragmentBounce(query: URLSearchParams): boolean {
  return !query.has(FRAGMENT_MARKER) && RESPONSE_PARAMS.every((name) => !query.has(name));
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
