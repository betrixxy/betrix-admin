import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { competitionKind, competitionName, resultRoundLabel, teamNameTr, upperTr } from "@/lib/dashboard/match-result-labels";
import { contrastRatio, readableOnDark, resultAccentHex, RESULT_SHADE_HEX } from "@/lib/dashboard/match-result-theme";
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
    assert.equal(competitionName("UCL", "UEFA Champions League"), "UEFA Şampiyonlar Ligi");
    assert.equal(competitionName("OTHER", "Premier League"), "Premier League");
    assert.equal(resultRoundLabel("Regular Season - 7"), "7. Hafta");
    assert.equal(resultRoundLabel("Quarter-finals"), "Çeyrek Final");
  });

  it("Türkçe takım adı ve tr-TR büyük harf", () => {
    assert.equal(teamNameTr("Besiktas"), "Beşiktaş");
    assert.equal(teamNameTr("Kocaelispor"), "Kocaelispor");
    assert.equal(upperTr("Beşiktaş"), "BEŞİKTAŞ");
  });

  it("koyu forma rengi koyu zeminde okunur hale açılır", () => {
    const accent = readableOnDark("#111111");
    assert.ok(contrastRatio(accent, RESULT_SHADE_HEX) >= 4.5);
    assert.equal(readableOnDark("#FF6B00"), "#ff6b00");
  });
});
