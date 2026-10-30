import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { buildMatchScorecardCaption, buildPeriodScorecardCaption } from "@/lib/dashboard/prediction-scorecard-caption";
import { buildMatchScorecardCard, buildPeriodScorecardCard } from "@/lib/dashboard/prediction-scorecard-card";
import { hasLink, hashtagCount, MAX_HASHTAGS } from "@/lib/dashboard/vitrin-caption";
import { findBannedWords } from "@/lib/prediction/banned-words";
import { contentLanguageGate } from "@/lib/prediction/content-language";
import { buildMatchScorecard, buildPeriodScorecard, MAX_MATCH_ROWS, STRIP_LENGTH } from "@/lib/prediction/scorecard";
import { hitSummary, RATE_LABEL, SCENARIO_KIND_LABELS, SMALL_SAMPLE_BADGE } from "@/lib/prediction/scorecard-labels";
import { inPeriod, periodFor } from "@/lib/prediction/scorecard-period";
import type { ScorecardEntry } from "@/types/prediction-scorecard";
import { KONYA_GS, KONYA_GS_ALL_SIX, KONYA_GS_RECORDS, octoberEntries, record } from "../fixtures/prediction-scorecard";

/**
 * Tahmin Karnesi kurucuları: SEÇME YASAĞI (tutmayan kayıt düşürülemez — kurucuda kayıt dışarıda bırakan
 * parametre yok, kart girdinin tamamını taşır), küçük örneklem, dönem sınırları (İstanbul), model sürümü
 * ayrımı, dil kapısı (her görünen sözcük, "isabet oranı" dahil).
 */

const sides = { home: KONYA_GS.home.name, away: KONYA_GS.away.name };
const october = periodFor("MONTH", new Date("2026-10-15T12:00:00Z"));

describe("A · maç karnesi", () => {
  it("bütün kayıtlar kartta: tuttu + tutmadı, soru / cevap / yüzde / gerçekleşen", () => {
    const built = buildMatchScorecard({ fixtureId: KONYA_GS.fixtureId, sides, score: KONYA_GS.score, records: KONYA_GS_RECORDS });
    assert.ok(built.ok);
    assert.deepEqual(
      built.data.rows.map((row) => [row.question, row.answer, row.percent, row.actual, row.status]),
      [
        ["Maçı kim kazanır?", "Galatasaray", "%52", "Galatasaray · 1–2", "HIT"],
        ["İlk yarı kimin?", "Galatasaray", "%41", "Beraberlik · İY 1–1", "MISS"],
      ],
    );
    assert.equal(built.data.summary.text, "2 tahminde 1 tuttu");
  });

  it("SEÇME YASAĞI: tutmayan kayıt düşmez — satır sayısı = kayıt sayısı, MISS kartta", () => {
    for (const records of [KONYA_GS_RECORDS, KONYA_GS_ALL_SIX, [...KONYA_GS_ALL_SIX].reverse()]) {
      const built = buildMatchScorecard({ fixtureId: KONYA_GS.fixtureId, sides, score: KONYA_GS.score, records });
      assert.ok(built.ok);
      assert.equal(built.data.rows.length, records.length);
      assert.deepEqual(new Set(built.data.rows.map((row) => row.recordId)), new Set(records.map((entry) => entry.id)));
      const misses = built.data.rows.filter((row) => row.status === "MISS").length;
      assert.ok(misses > 0);
      assert.equal(built.data.summary.total - built.data.summary.hits, misses);
      const card = buildMatchScorecardCard({ match: KONYA_GS, data: built.data, brandLogo: "data:image/png;base64,AA" });
      assert.equal(card.rows.length, records.length);
      assert.equal(card.strip.filter((status) => status === "MISS").length, misses);
    }
  });

  it("kurucunun seçme parametresi yok (imza sabit)", () => {
    const source = readFileSync("src/lib/prediction/scorecard.ts", "utf8");
    const signature = /export function buildMatchScorecard\(input: \{([^}]*)\}/u.exec(source)?.[1] ?? "";
    assert.deepEqual(signature.split(";").map((part) => part.split(":")[0]?.trim()).filter(Boolean), ["fixtureId", "sides", "score", "records"]);
    const period = /export function buildPeriodScorecard\(input: \{([^}]*)\}/u.exec(source)?.[1] ?? "";
    assert.deepEqual(period.split(";").map((part) => part.split(":")[0]?.trim()).filter(Boolean), ["period", "entries", "splitByModelVersion"]);
  });

  it("kayıt yok / başka maçın kaydı / ertelendi / bitmedi / kapasite → kart yok, Türkçe sebep", () => {
    const base = { fixtureId: KONYA_GS.fixtureId, sides, score: KONYA_GS.score };
    const code = (result: ReturnType<typeof buildMatchScorecard>) => (result.ok ? "OK" : result.error.code);
    const empty = buildMatchScorecard({ ...base, records: [] });
    assert.ok(!empty.ok && /yayınlanmış tahmin kaydı yok/u.test(empty.error.message));
    assert.equal(code(buildMatchScorecard({ ...base, records: [record("x", { scenario: "BTTS", pick: "YES" }, 0.5, { fixtureId: "api-football-1" })] })), "FOREIGN_RECORD");
    const postponed = buildMatchScorecard({ ...base, score: { ...KONYA_GS.score, statusShort: "PST" }, records: KONYA_GS_RECORDS });
    assert.ok(!postponed.ok && postponed.error.code === "VOID" && /ertelendi/u.test(postponed.error.message));
    assert.equal(code(buildMatchScorecard({ ...base, score: { ...KONYA_GS.score, statusShort: "2H" }, records: KONYA_GS_RECORDS })), "NOT_SETTLED");
    const seven = [...KONYA_GS_ALL_SIX, record("rec-g", { scenario: "BTTS", pick: "NO" }, 0.42, { recordedAt: "2026-10-29T11:00:00.000Z" })];
    assert.equal(seven.length, MAX_MATCH_ROWS + 1);
    assert.equal(code(buildMatchScorecard({ ...base, records: seven })), "TOO_MANY_ROWS");
  });
});

describe("küçük örneklem ve isabet oranı", () => {
  it("n < 10 → '3 tahminde 2 tuttu' + İLK TAHMİNLER; n ≥ 10 → yüzde", () => {
    assert.deepEqual(hitSummary(3, 2), { kind: "SMALL_SAMPLE", total: 3, hits: 2, text: "3 tahminde 2 tuttu", badge: SMALL_SAMPLE_BADGE });
    assert.equal(hitSummary(9, 9).kind, "SMALL_SAMPLE");
    assert.deepEqual(hitSummary(12, 7), { kind: "RATE", total: 12, hits: 7, percent: 58, text: "12 tahminde 7 tuttu · %58 isabet oranı" });
  });
});

describe("B · dönem karnesi", () => {
  it("dönemin BÜTÜN kayıtları: tutmayan düşmez, VOID ve bekleyen karneye girmez ama sayılır", () => {
    const entries: ScorecardEntry[] = [
      ...octoberEntries(7),
      { ...octoberEntries(1)[0]!, record: { ...octoberEntries(1)[0]!.record, id: "void" }, status: "VOID" },
      { ...octoberEntries(1)[0]!, record: { ...octoberEntries(1)[0]!.record, id: "pending" }, status: null },
      { ...octoberEntries(1)[0]!, record: { ...octoberEntries(1)[0]!.record, id: "november" }, kickoffUtc: "2026-11-01T17:00:00.000Z" },
    ];
    const built = buildPeriodScorecard({ period: october, entries, splitByModelVersion: false });
    assert.ok(built.ok);
    assert.equal(built.data.summary.total, 7);
    assert.equal(built.data.summary.hits, 5, "HHMHMHH");
    assert.equal(built.data.summary.text, "7 tahminde 5 tuttu");
    assert.equal(built.data.voided, 1);
    assert.equal(built.data.pending, 1);
    assert.deepEqual(built.data.strip, ["HIT", "HIT", "MISS", "HIT", "MISS", "HIT", "HIT"]);
    assert.equal(built.data.breakdown.reduce((sum, row) => sum + row.total, 0), 7);
    assert.equal(built.data.breakdown[0]?.label, SCENARIO_KIND_LABELS.RESULT_1X2);
  });

  it("şerit son N sonuç (eskiden yeniye), kırılım n ≥ 10'da yüzde", () => {
    const built = buildPeriodScorecard({ period: october, entries: octoberEntries(24), splitByModelVersion: false });
    assert.ok(built.ok && built.data.summary.kind === "RATE");
    assert.equal(built.data.strip.length, STRIP_LENGTH);
    assert.equal(built.data.summary.percent, Math.round((15 / 24) * 100));
    assert.equal(built.data.versions, null);
  });

  it("model sürümüne göre ayrım (null = poisson-v1); tek sürümde ayrım yok", () => {
    const built = buildPeriodScorecard({ period: october, entries: octoberEntries(24), splitByModelVersion: true });
    assert.ok(built.ok && built.data.versions);
    assert.deepEqual(built.data.versions.map((row) => [row.modelVersion, row.label, row.summary.total]), [["poisson-v1", "Model v1", 12], ["v2-season-xg", "Model v2", 12]]);
    const single = buildPeriodScorecard({ period: october, entries: octoberEntries(24).slice(12), splitByModelVersion: true });
    assert.ok(single.ok && single.data.versions === null);
  });

  it("dönemde sonuçlanmış kayıt yoksa kart yok", () => {
    const built = buildPeriodScorecard({ period: periodFor("WEEK", new Date("2026-12-01T12:00:00Z")), entries: octoberEntries(8), splitByModelVersion: false });
    assert.ok(!built.ok && built.error.code === "NO_RECORDS");
  });
});

describe("dönem sınırları (İstanbul)", () => {
  it("hafta Pazartesi 00:00 İstanbul — Pazar 23:59 maçı o haftada, Pazartesi 00:00 sonrakinde", () => {
    const week = periodFor("WEEK", new Date("2026-10-30T19:00:00Z"));
    assert.equal(week.start, "2026-10-25T21:00:00.000Z");
    assert.equal(week.end, "2026-11-01T21:00:00.000Z");
    assert.equal(week.label, "26.10 – 01.11.2026");
    assert.ok(inPeriod(week, "2026-11-01T20:59:00Z"));
    assert.ok(!inPeriod(week, "2026-11-01T21:00:00Z"));
    assert.equal(periodFor("WEEK", new Date("2026-11-01T21:30:00Z")).start, "2026-11-01T21:00:00.000Z", "UTC Pazar akşamı = İstanbul Pazartesi");
  });

  it("ay ve sezon (1 Temmuz)", () => {
    assert.deepEqual([october.start, october.end, october.label], ["2026-09-30T21:00:00.000Z", "2026-10-31T21:00:00.000Z", "EKİM 2026"]);
    assert.equal(periodFor("MONTH", new Date("2026-12-31T22:30:00Z")).label, "OCAK 2027");
    const season = periodFor("SEASON", new Date("2027-03-01T12:00:00Z"));
    assert.deepEqual([season.start, season.end, season.label], ["2026-06-30T21:00:00.000Z", "2027-06-30T21:00:00.000Z", "2026/27 SEZONU"]);
    assert.equal(periodFor("SEASON", new Date("2026-07-01T00:30:00+03:00")).label, "2026/27 SEZONU");
  });
});

describe("dil kapısı — kart ve gönderi metni", () => {
  it("'isabet oranı' serbest, tek başına 'oran' yasaklı (kapı zayıflatılmadı)", () => {
    assert.deepEqual(findBannedWords("%58 isabet oranı"), []);
    assert.deepEqual(findBannedWords(RATE_LABEL), []);
    assert.deepEqual(findBannedWords("tuttu / tutmadı · İLK TAHMİNLER · TAHMİN KARNESİ"), []);
    assert.deepEqual(findBannedWords("isabet oran"), ["oran"]);
  });

  it("A ve B kartlarının ve gönderi metinlerinin bütün metinleri kapıdan geçer; ≤ 5 hashtag, link yok", () => {
    const match = buildMatchScorecard({ fixtureId: KONYA_GS.fixtureId, sides, score: KONYA_GS.score, records: KONYA_GS_ALL_SIX });
    const small = buildPeriodScorecard({ period: october, entries: octoberEntries(7), splitByModelVersion: true });
    const rate = buildPeriodScorecard({ period: october, entries: octoberEntries(24), splitByModelVersion: true });
    assert.ok(match.ok && small.ok && rate.ok);
    const cards = [buildMatchScorecardCard({ match: KONYA_GS, data: match.data, brandLogo: "data:image/png;base64,AA" }), buildPeriodScorecardCard({ data: small.data, brandLogo: "x" }), buildPeriodScorecardCard({ data: rate.data, brandLogo: "x" })];
    const captions = [buildMatchScorecardCaption(KONYA_GS, match.data), buildPeriodScorecardCaption(small.data), buildPeriodScorecardCaption(rate.data)];
    for (const card of cards) assert.equal(contentLanguageGate({ card }), null);
    for (const caption of captions) {
      assert.equal(contentLanguageGate({ caption }), null);
      assert.ok(hashtagCount(caption) <= MAX_HASHTAGS);
      assert.ok(!hasLink(caption) && !/checkmatch\.net|betrix/iu.test(caption));
      assert.match(caption, /tutmayanlar dahil/u);
    }
    assert.equal(cards[2]?.hero.kind, "RATE");
    assert.equal(cards[1]?.hero.kind === "SMALL_SAMPLE" && cards[1].hero.badge, SMALL_SAMPLE_BADGE);
    assert.equal(cards[0]?.hero.kind === "SMALL_SAMPLE" && cards[0].hero.badge, null, "maç karnesinde 'ilk tahminler' etiketi yok");
    assert.equal(cards[0]?.subtitle, "KONYASPOR 1–2 GALATASARAY");
    assert.equal(cards[0]?.footerLine, "TRENDYOL SÜPER LİG · 10. HAFTA · 30.10.2026");
  });
});
