import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cardTeamName } from "@/lib/archive/names";
import { competitionKind, competitionName, resultRoundLabel, upperTr } from "@/lib/dashboard/match-result-labels";
import { isSimilarColor, liftLightness, toHsl } from "@/lib/dashboard/color-math";
import { contrastRatio, resultAccentHex, RESULT_SHADE_HEX } from "@/lib/dashboard/match-result-theme";
import { countedGoals, formatMinute, pickMvp, scorerLines, toMatchResultFacts } from "@/lib/services/api-football/match-result-mappers";
import type { ApiFootballEventRaw, ApiFootballFixtureResultRaw } from "@/lib/services/api-football/types";
import { RAW_GENCLERBIRLIGI_GALATASARAY, RAW_HOFFENHEIM_BESIKTAS } from "../fixtures/api-football/match-result";

const HOME = 167;
const AWAY = 549;

function goal(team: number, player: number, name: string, elapsed: number, detail = "Normal Goal", extra: number | null = null, comments: string | null = null): ApiFootballEventRaw {
  return { time: { elapsed, extra }, team: { id: team }, player: { id: player, name }, type: "Goal", detail, comments };
}

describe("Maç Sonucu — gerçek maç (Hoffenheim 2-3 Beşiktaş)", () => {
  const facts = toMatchResultFacts(RAW_HOFFENHEIM_BESIKTAS);

  it("skor, Türkçe takım adı, turnuva ve tur etiketi", () => {
    assert.ok(facts);
    assert.equal(facts.home.name, "Hoffenheim");
    assert.equal(facts.away.name, "Beşiktaş");
    assert.deepEqual([facts.home.goals, facts.away.goals, facts.outcome], [2, 3, "AWAY"]);
    assert.equal(facts.competition.kind, "UEL");
    assert.equal(facts.competition.name, "UEFA Avrupa Ligi");
    assert.equal(facts.roundLabel, "Lig Aşaması · 2. Maç");
    assert.equal(facts.penaltyScore, null);
  });

  it("goller tarafına yazılır, aynı oyuncunun golleri tek satırda", () => {
    assert.ok(facts);
    assert.deepEqual(
      facts.away.scorers.map((line) => [line.name, line.minutes.join(", ")]),
      [["Amir Murillo", "60'"], ["Oh Hyeon-gyu", "72', 79'"]],
    );
    assert.deepEqual(facts.home.scorers.map((line) => line.minutes[0]), ["68'", "87'"]);
  });

  it("MVP kazanan takımdan en yüksek rating", () => {
    assert.ok(facts);
    assert.deepEqual(facts.mvp && [facts.mvp.playerId, facts.mvp.side, facts.mvp.rating, facts.mvp.goals], [34710, "AWAY", 9.41, 2]);
  });

  it("vurgu rengi Avrupa Ligi turuncusu", () => {
    assert.ok(facts);
    assert.equal(resultAccentHex(facts), "#FF6B00");
  });

  it("bitmemiş maç için kart verisi üretilmez", () => {
    const live = { ...RAW_HOFFENHEIM_BESIKTAS, fixture: { ...RAW_HOFFENHEIM_BESIKTAS.fixture, status: { long: "Second Half", short: "2H", elapsed: 70 } } };
    assert.equal(toMatchResultFacts(live), null);
  });
});

describe("gol satırları", () => {
  it("uzatma dakikası, penaltı (P), kendi kalesine (KK) olayın takımına (golün yaradığı taraf) yazılır", () => {
    assert.equal(formatMinute(90, 2), "90+2'");
    assert.equal(formatMinute(45, null), "45'");
    // B ev sahibi oyuncusu; API KK olayını golün yaradığı takımla (AWAY) verir.
    const goals = [goal(HOME, 1, "A", 12, "Penalty"), goal(AWAY, 2, "B", 34, "Own Goal"), goal(AWAY, 3, "C", 90, "Normal Goal", 4)];
    assert.deepEqual(
      scorerLines(goals, HOME).map((line) => [line.name, line.minutes]),
      [["A", ["12' (P)"]]],
    );
    assert.deepEqual(
      scorerLines(goals, AWAY).map((line) => [line.name, line.minutes]),
      [["B", ["34' (KK)"]], ["C", ["90+4'"]]],
    );
  });

  it("gerçek maç: Gençlerbirliği 0-1 Galatasaray — Eğribayat KK'sı Galatasaray tarafında", () => {
    const facts = toMatchResultFacts(RAW_GENCLERBIRLIGI_GALATASARAY);
    assert.ok(facts);
    assert.deepEqual([facts.home.goals, facts.away.goals, facts.outcome], [0, 1, "AWAY"]);
    assert.deepEqual(facts.home.scorers, []);
    assert.deepEqual(
      facts.away.scorers.map((line) => [line.name, line.minutes]),
      [["İrfan Can Eğribayat", ["88' (KK)"]]],
    );
    // KK golü MVP önerisine gol olarak sayılmaz; MVP kazanan taraftan.
    assert.equal(facts.mvp?.side, "AWAY");
  });

  it("kaçan penaltı, penaltı atışları ve VAR iptali sayılmaz", () => {
    const events: ApiFootballEventRaw[] = [
      goal(HOME, 1, "A", 20, "Missed Penalty"),
      goal(HOME, 1, "A", 120, "Penalty", 3, "Penalty Shootout"),
      goal(AWAY, 3, "C", 55),
      { time: { elapsed: 55, extra: null }, team: { id: AWAY }, player: { id: 3, name: "C" }, type: "Var", detail: "Goal cancelled", comments: null },
      goal(AWAY, 3, "C", 77),
    ];
    assert.deepEqual(countedGoals(events).map((event) => event.time.elapsed), [77]);
  });
});

describe("MVP seçimi", () => {
  const withPlayers = (players: ApiFootballFixtureResultRaw["players"]): ApiFootballFixtureResultRaw => ({ ...RAW_HOFFENHEIM_BESIKTAS, players });
  const row = (id: number, name: string, rating: string | null) => ({ player: { id, name }, statistics: [{ games: { rating } }] });

  it("beraberlikte iki takımın en yüksek rating'i", () => {
    const raw = withPlayers([
      { team: { id: HOME }, players: [row(1, "Ev", "8.1")] },
      { team: { id: AWAY }, players: [row(2, "Dep", "7.9")] },
    ]);
    assert.equal(pickMvp(raw, "DRAW", [])?.name, "Ev");
    assert.equal(pickMvp(raw, "AWAY", [])?.name, "Dep");
  });

  it("rating yoksa en çok gol atan (kendi kalesine gol sayılmaz)", () => {
    const raw = withPlayers([{ team: { id: AWAY }, players: [row(2, "Dep", null)] }]);
    const goals = [goal(AWAY, 5, "Golcü", 10), goal(AWAY, 5, "Golcü", 50), goal(HOME, 6, "KK", 60, "Own Goal"), goal(AWAY, 7, "Diğer", 70)];
    assert.deepEqual([pickMvp(raw, "AWAY", goals)?.name, pickMvp(raw, "AWAY", goals)?.goals], ["Golcü", 2]);
  });
});

describe("etiketler ve tema", () => {
  it("turnuva eşlemesi ve tur etiketleri", () => {
    assert.equal(competitionKind(203), "SUPER_LIG");
    assert.equal(competitionKind(848), "UECL");
    assert.equal(competitionKind(39), "OTHER");
    assert.equal(competitionName(2, "UCL", "UEFA Champions League"), "UEFA Şampiyonlar Ligi");
    assert.equal(competitionName(203, "SUPER_LIG", "Süper Lig"), "Trendyol Süper Lig");
    assert.equal(competitionName(204, "OTHER", "1. Lig"), "Trendyol 1. Lig");
    assert.equal(competitionName(206, "TR_CUP", "Cup"), "Ziraat Türkiye Kupası");
    assert.equal(competitionName(848, "UECL", "UEFA Europa Conference League"), "UEFA Konferans Ligi");
    assert.equal(competitionName(39, "OTHER", "Premier League"), "Premier Lig"); // tek kaynak, Türkçe yayıncı adı (2026-10-30)
    assert.equal(resultRoundLabel("Regular Season - 7"), "7. Hafta");
    assert.equal(resultRoundLabel("Quarter-finals"), "Çeyrek Final");
  });

  it("Türkçe takım adı ve tr-TR büyük harf", () => {
    assert.equal(cardTeamName("Besiktas"), "Beşiktaş");
    assert.equal(cardTeamName("Kocaelispor"), "Kocaelispor");
    assert.equal(upperTr("Beşiktaş"), "BEŞİKTAŞ");
  });

  it("okunurluk: ton ve doygunluk korunur, yalnızca açıklık yükselir — kırmızı pembeye dönmez", () => {
    assert.equal(liftLightness("#FF6B00"), "#ff6b00"); // zaten okunuyor
    const red = liftLightness("#A90432");
    assert.ok(red);
    assert.ok(contrastRatio(red, RESULT_SHADE_HEX) >= 4.5);
    const [h0, s0] = toHsl("#A90432");
    const [h1, s1, l1] = toHsl(red);
    assert.ok(Math.abs(h0 - h1) * 360 < 2 && Math.abs(s0 - s1) < 0.03, `ton/doygunluk korunmalı: ${red}`);
    assert.ok(l1 <= 0.62);
    // Beyaza karıştırma pembe üretirdi: G ve B kanalları kırmızıya göre düşük kalmalı.
    const [r, g, b] = [1, 3, 5].map((i) => Number.parseInt(red.slice(i, i + 2), 16)) as [number, number, number];
    assert.ok(g < r * 0.35 && b < r * 0.5, `pembe değil kırmızı: ${red}`);
  });

  it("renksiz koyu (siyah) ve sınırda da okunmayan saf koyu mavi açılamaz → null (ikincile geçilir)", () => {
    assert.equal(liftLightness("#111111"), null);
    assert.equal(liftLightness("#00008B"), null);
    // Lacivert ise tonu korunarak okunur maviye açılır (pastele dönmeden).
    const navy = liftLightness("#0B1F4F");
    assert.ok(navy && Math.abs(toHsl(navy)[0] - toHsl("#0B1F4F")[0]) * 360 < 2);
  });

  it("benzerlik ton farkına da bakar: iki kırmızı benzer, kırmızı/altın değil", () => {
    assert.ok(isSimilarColor(liftLightness("#A90432") ?? "", liftLightness("#E30613") ?? ""));
    assert.ok(!isSimilarColor(liftLightness("#A90432") ?? "", "#FDB912"));
  });

  it("Gençlerbirliği 0-1 Galatasaray: iki kırmızı → vurgu GS ikincil altın (#FDB912)", () => {
    const real = toMatchResultFacts(RAW_GENCLERBIRLIGI_GALATASARAY);
    assert.ok(real);
    assert.equal(resultAccentHex(real), "#fdb912");
  });

  it("rakiple benzemeyen kazanan kendi birincil rengini (tonu korunmuş) alır", () => {
    const real = toMatchResultFacts(RAW_GENCLERBIRLIGI_GALATASARAY);
    assert.ok(real);
    // Ev sahibi lacivert-beyaz bir takım olsaydı GS kırmızısı kalırdı.
    const accent = resultAccentHex({ ...real, home: { ...real.home, id: 999_001, colorHex: "#FFFFFF" } });
    assert.equal(accent, liftLightness("#A90432"));
  });
});
