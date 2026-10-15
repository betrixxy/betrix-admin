import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { accountUpsertArgs } from "@/lib/metrics/account-row";
import { addDays, istanbulDay, istanbulDayBounds, istanbulHour, istanbulWeekday } from "@/lib/metrics/istanbul-time";
import { igInsightsSchema } from "@/lib/services/social/instagram-raw";
import {
  igUserCountsSchema,
  mapIgAccountDaily,
  mapXAccountDaily,
  parseBreakdownBuckets,
  parseFollowerSeries,
  parseFollowsUnfollows,
  xMeMetricsSchema,
} from "@/lib/services/social/metrics/account-mappers";
import { emptyAccountValues } from "@/types/account-metrics";

describe("İstanbul günü", () => {
  it("UTC 21:30 İstanbul'da ertesi gün 00:30", () => {
    const at = new Date("2026-10-14T21:30:00Z");
    assert.equal(istanbulDay(at), "2026-10-15");
    assert.equal(istanbulHour(at), 0);
  });

  it("gün sınırları UTC+3; hafta günü ISO (1 = Pazartesi)", () => {
    const { start, end } = istanbulDayBounds("2026-10-15");
    assert.equal(start.toISOString(), "2026-10-14T21:00:00.000Z");
    assert.equal(end.toISOString(), "2026-10-15T21:00:00.000Z");
    assert.equal(istanbulWeekday(new Date("2026-10-15T09:00:00Z")), 4);
    assert.equal(istanbulWeekday(new Date("2026-10-18T22:30:00Z")), 1);
  });

  it("gün ekleme ay sınırını aşar", () => {
    assert.equal(addDays("2026-10-31", 1), "2026-11-01");
    assert.equal(addDays("2026-03-01", -1), "2026-02-28");
  });
});

describe("Instagram hesap günlük eşlemesi", () => {
  const insights = igInsightsSchema.parse({
    data: [
      { name: "reach", period: "day", total_value: { value: 5400 } },
      { name: "accounts_engaged", period: "day", total_value: { value: 310 } },
      { name: "profile_links_taps", period: "day", total_value: { value: 22 } },
    ],
  });

  it("sayaçlar + insights; gelmeyen metrik null", () => {
    const values = mapIgAccountDaily(igUserCountsSchema.parse({ id: "1", followers_count: 4200, follows_count: 180, media_count: 400 }), insights, { follows: 14, unfollows: 5 });
    assert.equal(values.followerCount, 4200);
    assert.equal(values.reach, 5400);
    assert.equal(values.accountsEngaged, 310);
    assert.equal(values.profileLinksTaps, 22);
    assert.equal(values.views, null);
    assert.equal(values.follows, 14);
  });

  it("sayaç çağrısı başarısızsa takipçi null kalır, insights yine yazılır", () => {
    const values = mapIgAccountDaily(null, insights, { follows: null, unfollows: null });
    assert.equal(values.followerCount, null);
    assert.equal(values.reach, 5400);
  });

  it("takip/takipten çıkma kırılımı; 100 takipçi altında veri yoksa null", () => {
    const raw = igInsightsSchema.parse({
      data: [{ name: "follows_and_unfollows", total_value: { breakdowns: [{ dimension_keys: ["follow_type"], results: [{ dimension_values: ["FOLLOWER"], value: 14 }, { dimension_values: ["NON_FOLLOWER"], value: 5 }] }] } }],
    });
    assert.deepEqual(parseFollowsUnfollows(raw), { follows: 14, unfollows: 5 });
    assert.deepEqual(parseFollowsUnfollows(igInsightsSchema.parse({ data: [] })), { follows: null, unfollows: null });
  });

  it("günlük yeni takipçi serisi", () => {
    const raw = igInsightsSchema.parse({ data: [{ name: "follower_count", period: "day", values: [{ value: 9, end_time: "2026-10-02T07:00:00+0000" }, { value: 12, end_time: "2026-10-03T07:00:00+0000" }] }] });
    assert.deepEqual(parseFollowerSeries(raw).map((point) => point.value), [9, 12]);
  });
});

describe("kitle demografisi", () => {
  it("kırılım → kova; eşik altıysa null", () => {
    const raw = igInsightsSchema.parse({
      data: [{ name: "follower_demographics", total_value: { breakdowns: [{ dimension_keys: ["age"], results: [{ dimension_values: ["18-24"], value: 120 }, { dimension_values: ["25-34"], value: 340 }] }] } }],
    });
    assert.deepEqual(parseBreakdownBuckets(raw, "follower_demographics"), { "18-24": 120, "25-34": 340 });
    assert.equal(parseBreakdownBuckets(raw, "engaged_audience_demographics"), null);
    assert.equal(parseBreakdownBuckets(igInsightsSchema.parse({ data: [{ name: "follower_demographics", total_value: {} }] }), "follower_demographics"), null);
  });
});

describe("X hesap ve takipçi normalizasyonu", () => {
  it("public_metrics → takipçi/takip/gönderi; demografi alanı yok", () => {
    const values = mapXAccountDaily(xMeMetricsSchema.parse({ data: { id: "9", public_metrics: { followers_count: "2500", following_count: 90, tweet_count: 1800, listed_count: 3 } } }));
    assert.equal(values.followerCount, 2500);
    assert.equal(values.followingCount, 90);
    assert.equal(values.mediaCount, 1800);
    assert.equal(values.reach, null);
  });
});

describe("günlük hesap satırı upsert'i", () => {
  it("aynı platform + gün → aynı anahtar (yeni satır açılmaz), farklı gün → farklı anahtar", () => {
    const now = new Date("2026-10-15T00:30:00Z");
    const a = accountUpsertArgs("X", "2026-10-14", { ...emptyAccountValues(), followerCount: 10 }, {}, now);
    const b = accountUpsertArgs("X", "2026-10-14", { ...emptyAccountValues(), followerCount: 12 }, {}, new Date("2026-10-15T05:00:00Z"));
    const c = accountUpsertArgs("X", "2026-10-15", emptyAccountValues(), {}, now);
    assert.deepEqual(a.where, b.where);
    assert.notDeepEqual(a.where, c.where);
    assert.equal(b.update.followerCount, 12);
    assert.equal(a.create.date.toISOString(), "2026-10-14T00:00:00.000Z");
    assert.equal(a.update.backfilled, false);
  });
});
