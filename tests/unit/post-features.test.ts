import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { accountCsvRow, ACCOUNT_CSV_HEADERS } from "@/lib/dashboard/account-export";
import { toCsv } from "@/lib/dashboard/csv";
import { POST_CSV_HEADERS, postCsvRow, type PostExportInput } from "@/lib/dashboard/posts-export";
import {
  captionFeatures,
  formatRatio,
  isDerbyIntensity,
  linkPlacementOf,
  nearestFollowerCount,
  templateNameOf,
  timeFeatures,
} from "@/lib/metrics/post-features";
import { engagementPerFollower, engagementRateByReach, firstHourVelocity, interactionsOf } from "@/lib/metrics/post-performance";
import { emptyAccountValues } from "@/types/account-metrics";
import { emptyMetricValues } from "@/types/post-metrics";

describe("açıklama özellikleri", () => {
  it("emoji, soru, hashtag (Türkçe küçük harf, tekrarsız), kelime ve karakter", () => {
    const f = captionFeatures("Derbi günü 🔥🔥 Sizce kim kazanır? #SüperLig #Derbi #süperlig ⚽");
    assert.equal(f.emojiCount, 3);
    assert.equal(f.hasQuestion, true);
    assert.deepEqual(f.hashtags, ["süperlig", "derbi"]);
    assert.equal(f.captionWords, 8);
    assert.equal(f.captionChars, [..."Derbi günü 🔥🔥 Sizce kim kazanır? #SüperLig #Derbi #süperlig ⚽"].length);
    assert.equal(f.hasLink, false);
  });

  it("bağlantı: tam adres, www ve çıplak alan adı; yerleşim gövde/yok", () => {
    assert.equal(captionFeatures("Detaylar: https://betrix.pro/r/abc").hasLink, true);
    assert.equal(captionFeatures("checkmatch.net/analiz adresinde").hasLink, true);
    assert.equal(captionFeatures("Skor 2.1 değil 2-1").hasLink, false);
    assert.equal(linkPlacementOf({ hasLink: true }), "BODY");
    assert.equal(linkPlacementOf({ hasLink: false }, true), "FIRST_REPLY");
    assert.equal(linkPlacementOf({ hasLink: false }), "NONE");
  });

  it("boş açıklama", () => {
    const f = captionFeatures("   ");
    assert.equal(f.captionWords, 0);
    assert.equal(f.captionChars, 0);
    assert.deepEqual(f.hashtags, []);
  });
});

describe("zaman özellikleri (İstanbul)", () => {
  it("saat ve gün İstanbul'a göre; maçtan önce negatif", () => {
    const published = new Date("2026-10-17T22:15:00Z"); // İstanbul: 18 Ekim Pazar 01:15
    const kickoff = new Date("2026-10-18T17:00:00Z");
    const f = timeFeatures(published, kickoff);
    assert.equal(f.publishedHourIst, 1);
    assert.equal(f.weekdayIst, 7);
    assert.equal(f.hoursFromKickoff, -18.75);
    assert.equal(timeFeatures(published, null).hoursFromKickoff, null);
  });
});

describe("içerik ve maç bağlamı", () => {
  it("format kimlikleri → oran; şablon adı renderOptions'tan", () => {
    assert.equal(formatRatio("IG_FEED"), "4:5");
    assert.equal(formatRatio("IG_SQUARE"), "1:1");
    assert.equal(formatRatio("STORY"), "9:16");
    assert.equal(formatRatio("X_LANDSCAPE"), "16:9");
    assert.equal(formatRatio(null), null);
    assert.equal(templateNameOf({ template: "PREMIUM_BROADCAST" }), "PREMIUM_BROADCAST");
    assert.equal(templateNameOf({ kind: "PROBABLE_LINEUPS" }), "PROBABLE_LINEUPS");
    assert.equal(templateNameOf(null), null);
  });

  it("derbi işareti", () => {
    assert.equal(isDerbyIntensity("ELITE_DERBY"), true);
    assert.equal(isDerbyIntensity("RIVALRY"), false);
    assert.equal(isDerbyIntensity(null), null);
  });
});

describe("paylaşım anındaki takipçi (normalizasyon)", () => {
  const rows = [
    { day: "2026-10-10", followerCount: 4000 },
    { day: "2026-10-12", followerCount: null },
    { day: "2026-10-13", followerCount: 4100 },
    { day: "2026-10-16", followerCount: 4300 },
  ];

  it("aynı gün ya da öncesindeki en yakın bilinen değer; takipçisi olmayan satır atlanır", () => {
    assert.equal(nearestFollowerCount(rows, "2026-10-13"), 4100);
    assert.equal(nearestFollowerCount(rows, "2026-10-12"), 4000);
    assert.equal(nearestFollowerCount(rows, "2026-10-15"), 4100);
  });

  it("öncesi yoksa sonraki en yakın; hiç yoksa null", () => {
    assert.equal(nearestFollowerCount(rows, "2026-10-01"), 4000);
    assert.equal(nearestFollowerCount([], "2026-10-01"), null);
  });

  it("takipçi başına etkileşim", () => {
    const values = { ...emptyMetricValues(), likes: 80, comments: 10, shares: 5, saves: 5 };
    assert.equal(engagementPerFollower(values, 4000), 0.025);
    assert.equal(engagementPerFollower(values, null), null);
  });
});

describe("türetilmiş performans", () => {
  it("etkileşim/erişim; erişim yoksa izlenme, ikisi de yoksa null", () => {
    const base = { ...emptyMetricValues(), likes: 40, comments: 5, shares: 3, saves: 2 };
    assert.equal(interactionsOf(base), 50);
    assert.equal(engagementRateByReach({ ...base, reach: 1000 }), 0.05);
    assert.equal(engagementRateByReach({ ...base, views: 500 }), 0.1);
    assert.equal(engagementRateByReach(base), null);
  });

  it("ilk 1 saat hızı: en erken ≤1.5 sa snapshot", () => {
    const snap = (ageHours: number, likes: number) => ({ ...emptyMetricValues(), likes, ageHours });
    assert.equal(firstHourVelocity([snap(6, 300), snap(1.2, 60), snap(0, 0)]), 50);
    assert.equal(firstHourVelocity([snap(6, 300)]), null);
  });
});

describe("CSV dışa aktarma", () => {
  it("virgül, tırnak ve satır sonu kaçışı; BOM; formül enjeksiyonu engellenir", () => {
    const csv = toCsv(["a", "b", "c"], [["x,y", 'say "hi"', "=SUM(A1)"], [null, true, ["p", "q"]]]);
    assert.ok(csv.startsWith("﻿a,b,c\r\n"));
    assert.ok(csv.includes('"x,y","say ""hi""",\'=SUM(A1)'));
    assert.ok(csv.endsWith(",true,p|q\r\n"));
  });

  it("gönderi satırı başlık sayısıyla aynı uzunlukta; metrik ve oranlar dolu", () => {
    const input: PostExportInput = {
      id: "p1",
      platform: "X",
      source: "PANEL",
      publishedAt: new Date("2026-10-14T18:00:00Z"),
      permalink: "https://x.com/a/status/1",
      mediaType: "IMAGE",
      caption: "Maç günü!",
      features: null,
      latest: { ...emptyMetricValues(), likes: 10, impressions: 200, capturedAt: new Date("2026-10-15T18:00:00Z"), ageHours: 24, metricLevel: "PRIVATE" },
      snapshots: [],
      site: { linkClicks: 7, uniqueVisitors: 5, sessions: 6 },
    };
    const row = postCsvRow(input);
    assert.equal(row.length, POST_CSV_HEADERS.length);
    assert.equal(row[POST_CSV_HEADERS.indexOf("engagement_rate_reach")], 0.05);
    assert.equal(row[POST_CSV_HEADERS.indexOf("short_link_clicks")], 7);
    assert.equal(row[POST_CSV_HEADERS.indexOf("published_day_ist")], "2026-10-14");
  });

  it("hesap satırı başlıklarla hizalı", () => {
    const row = accountCsvRow({ ...emptyAccountValues(), followerCount: 4200, date: new Date("2026-10-14T00:00:00Z"), platform: "META_INSTAGRAM", backfilled: false, capturedAt: new Date("2026-10-15T00:10:00Z") });
    assert.equal(row.length, ACCOUNT_CSV_HEADERS.length);
    assert.equal(row[0], "2026-10-14");
    assert.equal(row[ACCOUNT_CSV_HEADERS.indexOf("follower_count")], 4200);
  });
});
