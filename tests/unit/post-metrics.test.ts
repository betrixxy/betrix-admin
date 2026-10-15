import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { autoCollectDeadline, dueCheckpoint, nextCheckpointAt, refreshedTooRecently, X_MIN_REFRESH_MS } from "@/lib/metrics/schedule";
import { chooseXReadPath, chunk, splitByPrivateWindow } from "@/lib/metrics/x-plan";
import { igInsightsSchema } from "@/lib/services/social/instagram-raw";
import { classifyMetaError, classifyXError } from "@/lib/services/social/metrics/errors";
import { igMetricList, mapIgInsights, mapIgMediaCounts, mapXTweetMetrics } from "@/lib/services/social/metrics/post-mappers";
import { xTweetSchema } from "@/lib/services/social/x-raw";

const H = 3_600_000;
const published = new Date("2026-10-01T12:00:00Z");
const at = (hours: number) => new Date(published.getTime() + hours * H);

describe("Instagram insights → snapshot", () => {
  const raw = igInsightsSchema.parse({
    data: [
      { name: "reach", period: "lifetime", values: [{ value: 1200 }] },
      { name: "views", total_value: { value: 3400 } },
      { name: "likes", values: [{ value: 90 }] },
      { name: "saved", values: [{ value: 7 }] },
      { name: "profile_visits", values: [{ value: 12 }] },
      { name: "ig_reels_video_view_total_time", values: [{ value: 125_400 }] },
      { name: "navigation", total_value: { value: { tap_forward: 3 } } },
    ],
  });

  it("values[0] ve total_value okunur; gelmeyen metrik null (0 değil)", () => {
    const { values, metricLevel } = mapIgInsights(raw);
    assert.equal(values.reach, 1200);
    assert.equal(values.views, 3400);
    assert.equal(values.likes, 90);
    assert.equal(values.saves, 7);
    assert.equal(values.profileVisits, 12);
    assert.equal(values.comments, null);
    assert.equal(values.impressions, null);
    assert.equal(metricLevel, null);
  });

  it("izlenme süresi milisaniyeden saniyeye", () => {
    assert.equal(mapIgInsights(raw).values.watchTimeSeconds, 125);
  });

  it("medya türüne göre metrik listesi; kaldırılmış impressions hiç istenmez", () => {
    assert.ok(igMetricList("STORY").includes("link_clicks"));
    assert.ok(!igMetricList("STORY").includes("saved"));
    assert.ok(igMetricList("REELS").includes("ig_reels_video_view_total_time"));
    assert.ok(!igMetricList("REELS").includes("profile_visits"));
    assert.ok(igMetricList("CAROUSEL").includes("follows"));
    for (const type of ["IMAGE", "CAROUSEL", "REELS", "STORY", null] as const) assert.ok(!igMetricList(type).includes("impressions"));
  });

  it("içe aktarma sayaçları yalnızca beğeni/yorum", () => {
    const { values } = mapIgMediaCounts({ like_count: 5, comments_count: 2 });
    assert.equal(values.likes, 5);
    assert.equal(values.comments, 2);
    assert.equal(values.reach, null);
  });
});

describe("X tweet → snapshot", () => {
  const base = { id: "1", text: "t", created_at: "2026-10-01T12:00:00Z", public_metrics: { retweet_count: 4, reply_count: 3, like_count: 20, quote_count: 1, bookmark_count: 2, impression_count: 900 } };

  it("özel metrikler gelince PRIVATE; gösterim ve link tıklaması non_public'ten", () => {
    const { values, metricLevel } = mapXTweetMetrics(xTweetSchema.parse({ ...base, non_public_metrics: { impression_count: 950, url_link_clicks: 11, user_profile_clicks: 6, engagements: 40 } }));
    assert.equal(metricLevel, "PRIVATE");
    assert.equal(values.impressions, 950);
    assert.equal(values.views, 950);
    assert.equal(values.linkClicks, 11);
    assert.equal(values.profileClicks, 6);
    assert.equal(values.totalInteractions, 40);
    assert.equal(values.shares, 5);
    assert.equal(values.saves, 2);
    assert.equal(values.reach, null);
  });

  it("30 günden eski (yalnızca public) — sessizce PUBLIC, link tıklaması null", () => {
    const { values, metricLevel } = mapXTweetMetrics(xTweetSchema.parse(base));
    assert.equal(metricLevel, "PUBLIC");
    assert.equal(values.impressions, 900);
    assert.equal(values.linkClicks, null);
    assert.equal(values.comments, 3);
  });
});

describe("çekim takvimi", () => {
  it("1s, 6s, 24s, 72s, 7g, 30g — geçilen son nokta, henüz çekilmediyse", () => {
    assert.equal(dueCheckpoint(published, "IMAGE", null, at(0.5)), null);
    assert.equal(dueCheckpoint(published, "IMAGE", null, at(1.2))?.label, "1h");
    assert.equal(dueCheckpoint(published, "IMAGE", at(1.2), at(5)), null);
    assert.equal(dueCheckpoint(published, "IMAGE", at(1.2), at(6.1))?.label, "6h");
    assert.equal(dueCheckpoint(published, "IMAGE", at(73), at(100)), null);
    assert.equal(dueCheckpoint(published, "IMAGE", at(73), at(169))?.label, "7d");
    assert.equal(dueCheckpoint(published, "IMAGE", at(169), at(721))?.label, "30d");
  });

  it("araya kaçırılan noktalar tek çekimle karşılanır (en son nokta)", () => {
    assert.equal(dueCheckpoint(published, "IMAGE", null, at(30))?.label, "24h");
  });

  it("30 günden eski gönderi otomatik çekilmez (12 saatlik pay sonrası)", () => {
    assert.equal(dueCheckpoint(published, "IMAGE", at(169), at(731))?.label, "30d");
    assert.equal(dueCheckpoint(published, "IMAGE", at(169), at(733)), null);
    assert.equal(dueCheckpoint(published, "IMAGE", null, at(24 * 60)), null);
    assert.equal(autoCollectDeadline(published, "IMAGE").toISOString(), at(732).toISOString());
  });

  it("story: 1/6/23 sa, 24 saatten sonra hiç", () => {
    assert.equal(dueCheckpoint(published, "STORY", at(6.5), at(23.2))?.label, "23h");
    assert.equal(dueCheckpoint(published, "STORY", at(6.5), at(25)), null);
    assert.equal(nextCheckpointAt(published, "STORY", at(7))?.toISOString(), at(23).toISOString());
    assert.equal(nextCheckpointAt(published, "STORY", at(23.5)), null);
  });

  it("bir sonraki nokta; takvim bitince null", () => {
    assert.equal(nextCheckpointAt(published, "IMAGE", at(2))?.toISOString(), at(6).toISOString());
    assert.equal(nextCheckpointAt(published, "IMAGE", at(721)), null);
  });

  it("X: aynı gönderi 1 saatten sık çekilmez", () => {
    assert.equal(refreshedTooRecently(at(10), at(10.5), X_MIN_REFRESH_MS), true);
    assert.equal(refreshedTooRecently(at(10), at(11), X_MIN_REFRESH_MS), false);
    assert.equal(refreshedTooRecently(null, at(11), X_MIN_REFRESH_MS), false);
  });
});

describe("X okuma yolu ve gruplar", () => {
  it("owned zaman akışı (5× ucuz) pencere yoğunken; seyrek pencerede kimlik sorgusu", () => {
    assert.equal(chooseXReadPath(10, 40), "timeline");
    assert.equal(chooseXReadPath(10, 50), "timeline");
    assert.equal(chooseXReadPath(10, 51), "ids");
    assert.equal(chooseXReadPath(1, 300), "ids");
  });

  it("100'lük gruplar", () => {
    const groups = chunk(Array.from({ length: 250 }, (_, i) => i), 100);
    assert.deepEqual(groups.map((group) => group.length), [100, 100, 50]);
  });

  it("özel metrik penceresi ~30 gün", () => {
    const now = at(24 * 40);
    const { recent, old } = splitByPrivateWindow([{ publishedAt: at(24 * 39) }, { publishedAt: at(24 * 5) }], now);
    assert.equal(recent.length, 1);
    assert.equal(old.length, 1);
  });
});

describe("sağlayıcı hata sınıfları", () => {
  it("Meta: token, silinmiş nesne, geçersiz metrik, hız limiti", () => {
    assert.equal(classifyMetaError("Instagram gönderi metrikleri: HTTP 400 Bad Request (type=OAuthException code=190 message=\"expired\")"), "AUTH");
    assert.equal(classifyMetaError("HTTP 400 Bad Request (type=GraphMethodException code=100 error_subcode=33)"), "GONE");
    assert.equal(classifyMetaError("HTTP 400 Bad Request (type=OAuthException code=100 message=\"metric[0] must be one of\")"), "INVALID_REQUEST");
    assert.equal(classifyMetaError("HTTP 400 Bad Request (code=10)"), "INVALID_REQUEST");
    assert.equal(classifyMetaError("HTTP 400 Bad Request (code=4)"), "RATE_LIMIT");
  });

  it("X: 401 yetki, 429 kredi/hız, 400 geçersiz", () => {
    assert.equal(classifyXError("X gönderi sorgusu: HTTP 401 Unauthorized"), "AUTH");
    assert.equal(classifyXError("HTTP 429 Too Many Requests"), "RATE_LIMIT");
    assert.equal(classifyXError("HTTP 400 Bad Request"), "INVALID_REQUEST");
    assert.equal(classifyXError("HTTP 503 Service Unavailable"), "OTHER");
  });
});
