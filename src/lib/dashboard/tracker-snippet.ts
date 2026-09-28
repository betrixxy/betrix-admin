/**
 * checkmatch.net'e (asıl site) eklenen hafif izleme kodu — `/api/track` ile birebir uyumlu
 * (bkz. app/api/track/route.ts). Trafik sayfası bu metni gösterir; tek kaynak burasıdır.
 *
 * Tasarım kararları:
 * - `Content-Type: text/plain` + site anahtarı `?key=` ile → CORS "basit istek"; ön-kontrol
 *   (preflight) yok, `keepalive` ile sayfa kapanırken bile gider.
 * - Ziyaretçi kimliği `localStorage`'da kalıcı UUID (tekil ziyaretçi), gönderi atfı
 *   (`cm_post` URL parametresi) `sessionStorage`'da o oturum boyunca taşınır.
 * - SPA geçişleri (`pushState`/`replaceState`/`popstate`) yakalanır; aynı yol tekrar sayılmaz.
 * - Yalnızca `location.pathname` gönderilir — sorgu dizesi (olası kişisel veri) gönderilmez.
 * - Otomasyon tarayıcıları (`navigator.webdriver`) sayılmaz.
 */

/** Sosyal medya linklerine eklenen, tıklamayı gönderiye bağlayan parametre (bkz. tracking-link.ts). */
export const POST_ATTRIBUTION_PARAM = "cm_post";

export interface TrackerSnippetOptions {
  /** Panelin kök adresi, ör. `https://studio.betrix.pro` — sonunda `/` olmadan. */
  panelOrigin: string;
  /** `TRACK_SITE_KEY` tanımlıysa aynı değer; boşsa anahtar gönderilmez. */
  siteKey: string;
}

export function buildTrackerSnippet({ panelOrigin, siteKey }: TrackerSnippetOptions): string {
  const endpoint = `${panelOrigin.replace(/\/+$/, "")}/api/track`;
  return `<!-- CheckMatch trafik takibi (betrix.pro Studio) — </body> etiketinden hemen önce -->
<script>
(function () {
  var ENDPOINT = ${JSON.stringify(endpoint)};
  var SITE_KEY = ${JSON.stringify(siteKey)};
  var POST_PARAM = ${JSON.stringify(POST_ATTRIBUTION_PARAM)};
  if (navigator.webdriver || !window.fetch) return;

  function read(storage, key) { try { return window[storage].getItem(key); } catch (e) { return null; } }
  function write(storage, key, value) { try { window[storage].setItem(key, value); } catch (e) {} }
  function newId() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return "v" + Date.now().toString(36) + Math.random().toString(36).slice(2, 14);
  }

  var visitorId = read("localStorage", "cm_vid");
  if (!visitorId) { visitorId = newId(); write("localStorage", "cm_vid", visitorId); }

  var postId = null;
  try { postId = new URLSearchParams(location.search).get(POST_PARAM); } catch (e) {}
  if (postId && /^[A-Za-z0-9_-]{1,64}$/.test(postId)) write("sessionStorage", "cm_post", postId);
  else postId = read("sessionStorage", "cm_post");

  var lastPath = null;
  function track() {
    var path = location.pathname || "/";
    if (path === lastPath) return;
    lastPath = path;
    var payload = { path: path.slice(0, 2048), sessionId: visitorId };
    if (postId) payload.postId = postId;
    try {
      fetch(ENDPOINT + (SITE_KEY ? "?key=" + encodeURIComponent(SITE_KEY) : ""), {
        method: "POST",
        mode: "cors",
        credentials: "omit",
        keepalive: true,
        headers: { "Content-Type": "text/plain" },
        body: JSON.stringify(payload)
      }).catch(function () {});
    } catch (e) {}
  }

  ["pushState", "replaceState"].forEach(function (name) {
    var original = history[name];
    history[name] = function () {
      var result = original.apply(this, arguments);
      setTimeout(track, 0);
      return result;
    };
  });
  window.addEventListener("popstate", track);
  track();
})();
</script>`;
}
