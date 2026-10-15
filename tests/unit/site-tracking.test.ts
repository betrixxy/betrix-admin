import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import { generateShortCode, isLikelyBot, referrerHostOf, SHORT_CODE_PATTERN, shortLinkUrl } from "@/lib/dashboard/short-link-code";
import { buildTrackingLink, campaignOf } from "@/lib/dashboard/tracking-link";
import { EMPTY_UTM, normalizeUtm, resolveAttribution } from "@/lib/dashboard/utm-attribution";

// env.ts içe aktarılırken doğrulanır — test ortamına güvenli yer tutucular (gerçek sır değil).
process.env.JWT_SECRET ??= "test-only-secret-not-used-anywhere-else";
process.env.DATABASE_URL ??= "postgresql://test:test@127.0.0.1:5432/test";

let hashIpWith: typeof import("@/lib/dashboard/ip-hash").hashIpWith;

before(async () => {
  ({ hashIpWith } = await import("@/lib/dashboard/ip-hash"));
});

describe("kısa link kodu", () => {
  it("7 karakter base62, desene uyar; her seferinde farklı", () => {
    const codes = new Set(Array.from({ length: 200 }, () => generateShortCode()));
    assert.equal(codes.size, 200);
    for (const code of codes) assert.match(code, SHORT_CODE_PATTERN);
  });

  it("62'nin katı olmayan baytlar atılır (eşit dağılım)", () => {
    const bytes = [255, 250, 248, 0, 61, 62, 123, 1, 2, 3, 4, 5, 6, 7, 8, 9];
    assert.equal(generateShortCode(() => Buffer.from(bytes)), "0z0z123");
  });

  it("adres SHORT_LINK_BASE_URL kökünden; alan adı değişince kod aynı kalır", () => {
    assert.equal(shortLinkUrl("https://www.betrix.pro", "Ab3dE5f"), "https://www.betrix.pro/r/Ab3dE5f");
    assert.equal(shortLinkUrl("https://go.checkmatch.net/", "Ab3dE5f"), "https://go.checkmatch.net/r/Ab3dE5f");
  });
});

describe("yönlendirme hedefi — UTM", () => {
  it("utm_source=x|instagram, medium=social, campaign=<contentType>, content=<socialPostId>; eski snippet için cm_post", () => {
    const url = new URL(buildTrackingLink({ socialPostId: "post123", platform: "X", contentType: "MATCH_DAY", path: "/analiz" }));
    assert.equal(url.origin + url.pathname, "https://checkmatch.net/analiz");
    assert.equal(url.searchParams.get("utm_source"), "x");
    assert.equal(url.searchParams.get("utm_medium"), "social");
    assert.equal(url.searchParams.get("utm_campaign"), "match_day");
    assert.equal(url.searchParams.get("utm_content"), "post123");
    assert.equal(url.searchParams.get("cm_post"), "post123");
    assert.equal(new URL(buildTrackingLink({ socialPostId: null, platform: "META_INSTAGRAM", contentType: null })).searchParams.get("utm_source"), "instagram");
  });

  it("içerik türü yoksa campaign=post; dış adrese yönlendirme yapılamaz", () => {
    assert.equal(campaignOf(null), "post");
    assert.equal(campaignOf("AI Market Prediction"), "ai_market_prediction");
    assert.equal(new URL(buildTrackingLink({ socialPostId: "p", platform: "X", contentType: null, path: "//evil.example/x" })).host, "checkmatch.net");
    assert.equal(new URL(buildTrackingLink({ socialPostId: "p", platform: "X", contentType: null, path: "https://evil.example" })).host, "checkmatch.net");
  });
});

describe("tıklama filtresi", () => {
  it("önizleme botları ve otomasyon araçları bot sayılır", () => {
    assert.equal(isLikelyBot("Twitterbot/1.0"), true);
    assert.equal(isLikelyBot("facebookexternalhit/1.1"), true);
    assert.equal(isLikelyBot("curl/8.4.0"), true);
    assert.equal(isLikelyBot(null), true);
    assert.equal(isLikelyBot("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148"), false);
  });

  it("referrer yalnızca alan adı olarak", () => {
    assert.equal(referrerHostOf("https://t.co/abc?x=1"), "t.co");
    assert.equal(referrerHostOf("çöp"), null);
  });
});

describe("IP özeti", () => {
  it("HMAC-SHA256 hex — migration'daki pgcrypto hmac() ile aynı sonuç; sabit anahtar → aynı IP aynı özet", () => {
    const secret = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
    assert.equal(hashIpWith(secret, "203.0.113.7"), "418926bbce793696b6c05aa969dcdbf07f6413ed5ff96592d602b7e6a986a7bf");
    assert.equal(hashIpWith(secret, "203.0.113.7"), hashIpWith(secret, " 203.0.113.7 "));
    assert.notEqual(hashIpWith(secret, "203.0.113.7"), hashIpWith(secret, "203.0.113.8"));
  });
});

describe("oturum bazlı UTM atfı", () => {
  const xUtm = normalizeUtm({ source: "X", medium: "social", campaign: "match_day", content: "post1" });

  it("giriş sayfası kendi UTM'ini taşır (devralma yok)", () => {
    const result = resolveAttribution({ utm: xUtm, postId: "post1" }, null);
    assert.equal(result.inherited, false);
    assert.equal(result.utm.source, "x");
    assert.equal(result.postId, "post1");
  });

  it("aynı oturumun sonraki sayfası UTM'siz gelir → ilk ziyaretten devralır", () => {
    const result = resolveAttribution({ utm: EMPTY_UTM, postId: null }, { utm: xUtm, postId: "post1" });
    assert.equal(result.inherited, true);
    assert.equal(result.utm.campaign, "match_day");
    assert.equal(result.postId, "post1");
  });

  it("oturumda atıflı ziyaret yoksa doğrudan/organik kalır; yeni UTM eskisini ezer", () => {
    assert.deepEqual(resolveAttribution({ utm: EMPTY_UTM, postId: null }, null), { utm: EMPTY_UTM, postId: null, inherited: false });
    const ig = normalizeUtm({ source: "instagram", medium: "social" });
    assert.equal(resolveAttribution({ utm: ig, postId: null }, { utm: xUtm, postId: "post1" }).utm.source, "instagram");
  });

  it("normalizasyon: boş → null, kaynak küçük harf, 200 karakter sınırı", () => {
    const utm = normalizeUtm({ source: "  Instagram ", medium: "", campaign: "a".repeat(300) });
    assert.equal(utm.source, "instagram");
    assert.equal(utm.medium, null);
    assert.equal(utm.campaign?.length, 200);
  });
});
