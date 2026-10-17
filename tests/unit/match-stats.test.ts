import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildMatchResultCard } from "@/lib/dashboard/match-result-card";
import { buildMatchStatsCard, statSections } from "@/lib/dashboard/match-stats-card";
import { readableOnDark } from "@/lib/dashboard/match-result-theme";
import { statsHighlight } from "@/lib/dashboard/match-stats-highlight";
import { formatStatValue, isRowVisible, parseStatValue, plainLabel, statBar, statTones, summaryRowKeys, upperLabel } from "@/lib/dashboard/match-stats-rows";
import { isSameTeam, searchableTeamName } from "@/lib/services/sportmonks/advanced-stats-mappers";
import { isSimilarColor, NEUTRAL_SILVER, statsPalette, trailHex } from "@/lib/dashboard/match-stats-theme";
import { setDateLabel } from "@/lib/dashboard/checkmatch-set";
import { backdropText } from "@/lib/dashboard/match-result-backdrop";
import { statRows, tacklesAndInterceptions, toMatchStatsFacts } from "@/lib/services/api-football/post-match-stats-mappers";
import { toMatchResultFacts } from "@/lib/services/api-football/match-result-mappers";
import type { ApiFootballFixtureResultRaw } from "@/lib/services/api-football/types";
import { sportmonksMatchValues } from "@/lib/services/sportmonks/match-stats-mappers";
import { SET_PAGE_LABELS, type SetCard } from "@/types/checkmatch-set";
import type { MatchStatsFacts, StatRowValue } from "@/types/match-stats";
import { RAW_BESIKTAS_MIDTJYLLAND, RAW_HOFFENHEIM_BESIKTAS_STATS } from "../fixtures/api-football/match-stats";
import { SM_BESIKTAS_MIDTJYLLAND, SM_BESIKTAS_MIDTJYLLAND_IDS, SM_HOFFENHEIM_BESIKTAS, SM_HOFFENHEIM_BESIKTAS_IDS } from "../fixtures/sportmonks/match-stats";

const sportmonks = sportmonksMatchValues(SM_BESIKTAS_MIDTJYLLAND, SM_BESIKTAS_MIDTJYLLAND_IDS);
const facts = toMatchStatsFacts(RAW_BESIKTAS_MIDTJYLLAND, sportmonks) as MatchStatsFacts;
const rowOf = (f: MatchStatsFacts, key: StatRowValue["key"]) => f.rows.find((r) => r.key === key);

/** API-Football istatistiği dolu bir kopya — iki taraf "%88" / "62%" gibi farklı biçimlerde. */
function withApiFootballStats(stats: Record<string, [number | string | null, number | string | null]>): ApiFootballFixtureResultRaw {
  const raw = structuredClone(RAW_BESIKTAS_MIDTJYLLAND);
  raw.statistics = [
    { team: { id: raw.teams.home.id }, statistics: Object.entries(stats).map(([type, [home]]) => ({ type, value: home })) },
    { team: { id: raw.teams.away.id }, statistics: Object.entries(stats).map(([type, [, away]]) => ({ type, value: away })) },
  ];
  return raw;
}

describe("Maç İstatistikleri — değer ayrıştırma", () => {
  it('"75%", "%75", "75" ve sayı aynı değere çevrilir', () => {
    for (const value of ["75%", "%75", "75", " 75 ", 75]) assert.equal(parseStatValue(value), 75);
    assert.equal(parseStatValue("1,84"), 1.84);
    assert.equal(parseStatValue("1.84"), 1.84);
  });

  it("boş, null ve sayı olmayan değer null kalır (sıfır sanılmaz)", () => {
    for (const value of [null, undefined, "", "%", "abc", "12a"]) assert.equal(parseStatValue(value), null);
  });

  it("Türkçe yazım: yüzde başta, ondalık virgül", () => {
    assert.equal(formatStatValue("possession", 75), "%75");
    assert.equal(formatStatValue("xg", 1.8), "1,80");
    assert.equal(formatStatValue("shotsTotal", 28), "28");
  });
});

describe("Maç İstatistikleri — çubuk kuralları", () => {
  it("pas isabeti %88-%62: her taraf kendi 0-100 çubuğu — 50/50 çizilmez", () => {
    const raw = withApiFootballStats({ "Passes %": ["%88", "62%"] });
    const row = rowOf(toMatchStatsFacts(raw, null) as MatchStatsFacts, "passAccuracy");
    assert.ok(row);
    assert.deepEqual(statBar(row), { home: 0.88, away: 0.62, empty: false });
    assert.deepEqual(statTones(row), { home: "lead", away: "trail" });
  });

  it("share100: her çubuk kendi yüzdesi kadar", () => {
    assert.deepEqual(statBar({ key: "possession", home: 75, away: 25, source: "sportmonks" }), { home: 0.75, away: 0.25, empty: false });
  });

  it("count: her çubuk payı kadar (28-5 → 0,85 / 0,15)", () => {
    const bar = statBar({ key: "shotsTotal", home: 28, away: 5, source: "sportmonks" });
    assert.equal(bar.home.toFixed(3), (28 / 33).toFixed(3));
    assert.equal(bar.away.toFixed(3), (5 / 33).toFixed(3));
  });

  it("count 0-0 → boş (gri)", () => {
    assert.deepEqual(statBar({ key: "corners", home: 0, away: 0, source: "api-football" }), { home: 0, away: 0, empty: true });
  });

  it("faul/kart/ofsayt nötr; higherIsBetter satırda önde olan parlak, eşitlikte ikisi parlak", () => {
    assert.deepEqual(statTones({ key: "fouls", home: 12, away: 9, source: "sportmonks" }), { home: "neutral", away: "neutral" });
    assert.deepEqual(statTones({ key: "offsides", home: 1, away: 0, source: "sportmonks" }), { home: "neutral", away: "neutral" });
    assert.deepEqual(statTones({ key: "shotsTotal", home: 5, away: 28, source: "sportmonks" }), { home: "trail", away: "lead" });
    assert.deepEqual(statTones({ key: "corners", home: 3, away: 3, source: "sportmonks" }), { home: "lead", away: "lead" });
  });

  it("kırmızı kart ve direkten dönen 0-0 ise gizlenir; diğer 0-0 satırlar kalır", () => {
    assert.equal(isRowVisible({ key: "redCards", home: 0, away: 0, source: "api-football" }), false);
    assert.equal(isRowVisible({ key: "woodwork", home: 0, away: 0, source: "sportmonks" }), false);
    assert.equal(isRowVisible({ key: "redCards", home: 0, away: 1, source: "api-football" }), true);
    assert.equal(isRowVisible({ key: "yellowCards", home: 0, away: 0, source: "api-football" }), true);
  });
});

describe("Maç İstatistikleri — veri (Beşiktaş 1-0 Midtjylland)", () => {
  it("API-Football boşsa satır Sportmonks'tan gelir", () => {
    assert.deepEqual(rowOf(facts, "possession"), { key: "possession", home: 75, away: 25, source: "sportmonks" });
    assert.deepEqual(rowOf(facts, "shotsTotal"), { key: "shotsTotal", home: 28, away: 5, source: "sportmonks" });
    assert.deepEqual(rowOf(facts, "passAccuracy"), { key: "passAccuracy", home: 88, away: 62, source: "sportmonks" });
    assert.deepEqual(rowOf(facts, "woodwork"), { key: "woodwork", home: 1, away: 0, source: "sportmonks" });
  });

  it("API-Football iki tarafı da veriyorsa o kullanılır (kartlar)", () => {
    assert.deepEqual(rowOf(facts, "redCards"), { key: "redCards", home: 0, away: 1, source: "api-football" });
    assert.deepEqual(rowOf(facts, "yellowCards"), { key: "yellowCards", home: 0, away: 0, source: "api-football" });
  });

  it("top çalma + müdahale: oyuncu verisi yoksa Sportmonks TACKLES + INTERCEPTIONS", () => {
    assert.equal(tacklesAndInterceptions(RAW_BESIKTAS_MIDTJYLLAND, 549), null);
    assert.deepEqual(rowOf(facts, "tacklesInterceptions"), { key: "tacklesInterceptions", home: 11, away: 25, source: "sportmonks" });
  });

  it("iki kaynakta da olmayan satır yok: xG, kaçan net pozisyon, ceza sahası içi", () => {
    for (const key of ["xg", "bigChancesMissed", "shotsInsideBox"] as const) assert.equal(rowOf(facts, key), undefined);
  });

  it("Sportmonks eşleşmezse yalnızca API-Football satırları (bu maçta yalnızca kartlar)", () => {
    const only = toMatchStatsFacts(RAW_BESIKTAS_MIDTJYLLAND, null) as MatchStatsFacts;
    assert.deepEqual(only.rows.map((r) => r.key), ["yellowCards", "redCards"]);
    assert.equal(only.sportmonksMatched, false);
  });

  it("top çalma + müdahale oyuncuların tackles.total + interceptions toplamıdır", () => {
    const raw = structuredClone(RAW_BESIKTAS_MIDTJYLLAND);
    const player = (id: number, total: number | null, interceptions: number | null) => ({
      player: { id, name: `P${id}` },
      statistics: [{ tackles: { total, interceptions } }],
    });
    raw.players = [
      { team: { id: 549 }, players: [player(1, 3, 2), player(2, null, 4), player(3, null, null)] },
      { team: { id: 397 }, players: [player(4, 1, 0)] },
    ];
    assert.equal(tacklesAndInterceptions(raw, 549), 9);
    const row = statRows(raw, sportmonks).find((r) => r.key === "tacklesInterceptions");
    assert.deepEqual(row, { key: "tacklesInterceptions", home: 9, away: 1, source: "api-football" });
  });

  it("kart sayıları iki kaynakta farklıysa uyarı; değer API-Football'dan kalır", () => {
    const raw = withApiFootballStats({ "Yellow Cards": [2, 1], "Red Cards": [0, 1] });
    const conflicting = { ...sportmonks, yellowCards: { home: 3, away: 1 }, redCards: { home: 0, away: 1 } };
    const result = toMatchStatsFacts(raw, conflicting) as MatchStatsFacts;
    assert.deepEqual(rowOf(result, "yellowCards"), { key: "yellowCards", home: 2, away: 1, source: "api-football" });
    assert.equal(result.warnings.length, 1);
    assert.match(result.warnings[0] ?? "", /^Sarı kart: API-Football 2-1, Sportmonks 3-1/);
  });

  it("kartlar tutarlıysa uyarı yok", () => {
    assert.deepEqual(facts.warnings, []);
  });

  it("bitmemiş maçta facts üretilmez", () => {
    const raw = structuredClone(RAW_BESIKTAS_MIDTJYLLAND);
    raw.fixture.status.short = "2H";
    assert.equal(toMatchStatsFacts(raw, sportmonks), null);
  });

  it("Türkçe takım adı", () => {
    assert.equal(facts.home.name, "Beşiktaş");
    assert.equal(facts.away.name, "Midtjylland");
    assert.equal(facts.roundLabel, "2. Ön Eleme Turu");
  });
});

describe("CheckMatch set — Maç Sonucu ile aynı kaynak", () => {
  it("skor, golcüler, turnuva ve vurgu rengi iki kartta aynı", () => {
    const result = toMatchResultFacts(RAW_BESIKTAS_MIDTJYLLAND);
    assert.ok(result);
    const images = { homeLogo: null, awayLogo: null, leagueLogo: null, brandLogo: "" };
    const resultCard = buildMatchResultCard(result, images, result.mvp?.name ?? null, SET_PAGE_LABELS.RESULT);
    const statsCard = buildMatchStatsCard(facts, "SUMMARY", images, SET_PAGE_LABELS.STATS);
    const shared: (keyof SetCard)[] = ["homeTeam", "awayTeam", "homeGoals", "awayGoals", "outcome", "penaltyLabel", "homeScorers", "awayScorers", "competitionLabel", "roundLabel", "accentHex"];
    for (const key of shared) assert.deepEqual(statsCard[key], resultCard[key], key);
    assert.equal(statsCard.accentHex, "#FF6B00");
    assert.deepEqual(statsCard.homeScorers.map((line) => line.minutes), [["26'"]]);
    assert.equal(resultCard.pageLabel, "01 · MAÇ SONUCU");
    assert.equal(statsCard.pageLabel, "02 · İSTATİSTİKLER");
  });

  it("tek başına paylaşılan Maç Sonucu kartında sayfa etiketi yok", () => {
    const result = toMatchResultFacts(RAW_BESIKTAS_MIDTJYLLAND);
    assert.ok(result);
    assert.equal(buildMatchResultCard(result, { homeLogo: null, awayLogo: null, leagueLogo: null, brandLogo: "" }, null).pageLabel, null);
  });
});

describe("Maç İstatistikleri — sayfalar", () => {
  it("Özet: xG ve kaçan net pozisyon yok → yedeklerle (tehlikeli atak, top çalma) 8 satır", () => {
    const [summary] = statSections(facts, "SUMMARY");
    assert.deepEqual(summary?.rows.map((r) => r.key), [
      "possession",
      "shotsTotal",
      "shotsOnTarget",
      "corners",
      "passAccuracy",
      "saves",
      "dangerousAttacks",
      "tacklesInterceptions",
    ]);
    assert.equal(summary?.title, null);
  });

  it("Detay: özette kullanılmayan satırlar Hücum / Pas / Disiplin başlıklarıyla (boş bölüm yok)", () => {
    const sections = statSections(facts, "DETAIL");
    assert.deepEqual(
      sections.map((s) => [s.title, s.rows.map((r) => r.key)]),
      [
        ["HÜCUM", ["shotsOffTarget", "shotsBlocked", "woodwork", "offsides"]],
        ["PAS", ["passes"]],
        ["DİSİPLİN", ["fouls", "yellowCards", "redCards"]],
      ],
    );
  });

  it("yedekler: direkten dönen yalnızca toplam > 0 ise; tamamlanamazsa olan kadar", () => {
    const rows = (values: [StatRowValue["key"], number, number][]): StatRowValue[] => values.map(([key, home, away]) => ({ key, home, away, source: "api-football" }));
    assert.deepEqual(summaryRowKeys(rows([["possession", 50, 50], ["woodwork", 0, 0], ["fouls", 10, 12]])), ["possession", "fouls"]);
    assert.deepEqual(summaryRowKeys(rows([["possession", 50, 50], ["woodwork", 1, 0], ["fouls", 10, 12]])), ["possession", "woodwork", "fouls"]);
  });
});

describe("Maç İstatistikleri — xG olan maç (Hoffenheim 2-3 Beşiktaş)", () => {
  const hof = toMatchStatsFacts(RAW_HOFFENHEIM_BESIKTAS_STATS, sportmonksMatchValues(SM_HOFFENHEIM_BESIKTAS, SM_HOFFENHEIM_BESIKTAS_IDS)) as MatchStatsFacts;
  const card = buildMatchStatsCard(hof, "SUMMARY", { homeLogo: null, awayLogo: null, leagueLogo: null, brandLogo: "" }, SET_PAGE_LABELS.STATS);

  it("öncelik listesinin tamamı dolu: 8 satır, yedek yok", () => {
    assert.deepEqual(card.sections[0]?.rows.map((r) => r.key), ["possession", "xg", "shotsTotal", "shotsOnTarget", "bigChancesMissed", "corners", "passAccuracy", "saves"]);
  });

  it("xG etiketi büyük harfe çevrilirken 'xG' korunur; dipnot eklenir", () => {
    assert.equal(card.sections[0]?.rows[1]?.label, "BEKLENEN GOL (xG)");
    assert.equal(card.sections[0]?.rows[1]?.homeText, "1,23");
    assert.equal(card.footnote, "xG: Pozisyonların gole dönme ihtimallerinin toplamı. Yüksek xG = daha net fırsat.");
    assert.equal(buildMatchStatsCard(facts, "SUMMARY", { homeLogo: null, awayLogo: null, leagueLogo: null, brandLogo: "" }, null).footnote, null);
  });

  it("pas isabeti 'Passes %' yokken isabetli/toplam pastan (API-Football) hesaplanır", () => {
    assert.deepEqual(rowOf(hof, "passAccuracy"), { key: "passAccuracy", home: 79, away: 79, source: "api-football" });
  });

  it("API-Football dolu satırda Sportmonks'un farklı değeri kullanılmaz (top hakimiyeti 53-47)", () => {
    assert.deepEqual(rowOf(hof, "possession"), { key: "possession", home: 53, away: 47, source: "api-football" });
    assert.deepEqual(rowOf(hof, "bigChancesMissed"), { key: "bigChancesMissed", home: 3, away: 3, source: "sportmonks" });
  });
});

describe("Etiket büyük harf dönüşümü", () => {
  it("süslü parantez içi muaf, geri kalanı tr-TR", () => {
    assert.equal(upperLabel("Beklenen gol ({xG})"), "BEKLENEN GOL (xG)");
    assert.equal(upperLabel("İsabetli şut"), "İSABETLİ ŞUT");
    assert.equal(upperLabel("{xG} ve {PPDA} farkı"), "xG VE PPDA FARKI");
    assert.equal(plainLabel("Beklenen gol ({xG})"), "Beklenen gol (xG)");
  });

  it("Sportmonks takım adı eşlemesi: kuruluş yılı ve TSG eki yok sayılır", () => {
    assert.ok(isSameTeam("TSG Hoffenheim", "1899 Hoffenheim"));
    assert.equal(searchableTeamName("1899 Hoffenheim"), "Hoffenheim");
    assert.equal(searchableTeamName("Beşiktaş"), "Besiktas");
  });
});

describe("Maç İstatistikleri — öne çıkan satır", () => {
  it("xG yokken şut üstünlüğü kuralı", () => {
    assert.equal(statsHighlight(facts), "BEŞİKTAŞ · 28 ŞUT, 7 İSABET — TEK GOL");
  });

  it("xG farkı ≥ 1,5 ve gol farkı ≤ 1", () => {
    const xg: MatchStatsFacts = { ...facts, rows: [...facts.rows, { key: "xg", home: 2.41, away: 0.3, source: "api-football" }] };
    assert.equal(statsHighlight(xg), "BEŞİKTAŞ · 28 ŞUT, 2,41 xG — TEK GOL");
  });

  it("düşük topla kazanma", () => {
    const rows: StatRowValue[] = [{ key: "possession", home: 68, away: 32, source: "api-football" }];
    const lowPossession: MatchStatsFacts = { ...facts, outcome: "AWAY", home: { ...facts.home, goals: 0 }, away: { ...facts.away, goals: 1 }, rows };
    assert.equal(statsHighlight(lowPossession), "MİDTJYLLAND · %32 TOPLA KAZANDI");
  });

  it("tek isabetle gol", () => {
    const rows: StatRowValue[] = [{ key: "shotsOnTarget", home: 1, away: 4, source: "api-football" }];
    assert.equal(statsHighlight({ ...facts, rows }), "BEŞİKTAŞ · TEK İSABETLİ ŞUT, TEK GOL");
  });

  it("kural tutmazsa satır yok", () => {
    const rows: StatRowValue[] = [{ key: "shotsTotal", home: 12, away: 9, source: "api-football" }];
    assert.equal(statsHighlight({ ...facts, rows }), null);
  });
});

describe("Maç İstatistikleri — renkler", () => {
  it("beyaz ve siyah forma: siyah griye açılıp nötrle karışacağı için ikincil renge (kırmızı) düşer", () => {
    const { homeHex, awayHex } = statsPalette(facts);
    assert.equal(homeHex, "#ffffff");
    assert.equal(awayHex, readableOnDark("#D3122A"));
  });

  it("ikincil rengi bilinmeyen siyah forma gri kalır ama ev sahibinden ayrışır", () => {
    const { homeHex, awayHex } = statsPalette({ home: facts.home, away: { ...facts.away, id: 1 } });
    assert.ok(!isSimilarColor(homeHex, awayHex));
  });

  it("aynı renk: deplasman ikincil renge düşer", () => {
    // Kırmızı ev sahibi vs Galatasaray (645) kırmızı → sarı.
    const { homeHex, awayHex } = statsPalette({ home: { ...facts.home, id: 1, colorHex: "#E30A17" }, away: { ...facts.away, id: 645, colorHex: "#C8102E" } });
    assert.ok(!isSimilarColor(homeHex, awayHex));
    assert.equal(awayHex, readableOnDark("#FDB912"));
  });

  it("ikincil rengi bilinmeyen benzer renk: nötr gümüş", () => {
    const { awayHex } = statsPalette({ home: { ...facts.home, colorHex: "#E30A17" }, away: { ...facts.away, id: 1, colorHex: "#D0101A" } });
    assert.equal(awayHex.toLowerCase(), NEUTRAL_SILVER.toLowerCase());
  });
});

describe("CheckMatch set — tasarım kuralları", () => {
  it("geride kalan renk: aynı ton, koyu ve doygun (opaklık değil, kahverengiye kaymaz)", () => {
    const lead = "#dc4155";
    const trail = trailHex(lead);
    const [r, g, b] = [1, 3, 5].map((i) => Number.parseInt(trail.slice(i, i + 2), 16)) as [number, number, number];
    assert.ok(r > g * 2 && r > b * 1.5, `kırmızı baskın kalmalı: ${trail}`);
    assert.ok(Math.max(r, g, b) < 0xdc, `koyulaşmalı: ${trail}`);
    assert.equal(trailHex("#ffffff"), "#8c8c8c");
    // Sarı daha az koyulaşır — zeytine/kahverengiye kaymaz (kırmızı, yeşilin belirgin üstünde kalır).
    const yellow = trailHex("#f5c518");
    const [yr, yg, yb] = [1, 3, 5].map((i) => Number.parseInt(yellow.slice(i, i + 2), 16)) as [number, number, number];
    assert.ok(yr > 0xa0 && yr > yg && yg > yb * 4, `koyu hardal beklenirdi: ${yellow}`);
  });

  it("sağ üst tarih: maçın İstanbul günü, dd.MM.yyyy", () => {
    assert.equal(setDateLabel("2026-07-23T18:00:00+00:00"), "23.07.2026");
    assert.equal(setDateLabel("2026-07-23T22:30:00+00:00"), "24.07.2026");
  });

  it("01 arka plan tipografisi: galibiyette skor, beraberlikte BERABERE", () => {
    assert.equal(backdropText("HOME", 1, 0), "1-0");
    assert.equal(backdropText("AWAY", 2, 3), "2-3");
    assert.equal(backdropText("DRAW", 1, 1), "BERABERE");
    // Penaltılarla biten maçta kazanan var, skor eşit — yine skor yazılır.
    assert.equal(backdropText("HOME", 1, 1), "1-1");
  });
});
