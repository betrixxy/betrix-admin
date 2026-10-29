import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cardTeamName } from "@/lib/archive/names";
import { buildDrawCard, teamCard } from "@/lib/dashboard/draw-card";
import { shortDate as dayMonth } from "@/lib/format/dates";
import { leagueFixturesFromApi, tiesFromApi } from "@/lib/draw/api-mappers";
import { compareLeague, compareTies } from "@/lib/draw/compare";
import { addLeagueFixture, addTie, drawTeamName, emptyDraw, leagueOpponentLimit, removeTie } from "@/lib/draw/entry";
import { headToHeadFact, headToHeadRecord } from "@/lib/draw/facts";
import type { ApiFootballFixtureRaw } from "@/lib/services/api-football/types";
import type { DrawState } from "@/types/draw";
import { DRAW_KNOCKOUT, DRAW_LEAGUE } from "../fixtures/draw";

const knockoutEmpty: DrawState = { ...DRAW_KNOCKOUT, ties: [] };
const leagueEmpty: DrawState = { ...DRAW_LEAGUE, fixtures: [] };
const input = { logos: {}, brandLogo: "" };

describe("eşleşme girişi", () => {
  it("eleme: eşleşme eklenir; aynı takım ikinci eşleşmede reddedilir; kendisiyle eşleşmez; listede olmayan takım reddedilir", () => {
    const first = addTie(knockoutEmpty, { first: 611, second: 211, firstLegUtc: null, secondLegUtc: null });
    assert.ok(first.ok);
    const again = addTie(first.state, { first: 211, second: 530, firstLegUtc: null, secondLegUtc: null });
    assert.equal(again.ok, false);
    assert.equal(!again.ok && again.error, "Benfica zaten bir eşleşmede.");
    assert.equal(addTie(knockoutEmpty, { first: 611, second: 611, firstLegUtc: null, secondLegUtc: null }).ok, false);
    assert.equal(addTie(knockoutEmpty, { first: 611, second: 999999, firstLegUtc: null, secondLegUtc: null }).ok, false);
    assert.deepEqual(removeTie(first.state, 0).ties, []);
  });

  it("lig aşaması: ŞL/AL 8 rakip, KL 6; aynı rakip iki kez yok; yanlış türde giriş reddedilir", () => {
    assert.equal(leagueOpponentLimit(2), 8);
    assert.equal(leagueOpponentLimit(848), 6);
    let state = leagueEmpty;
    for (const opponentId of [163, 211, 530, 40, 497, 66, 560, 550]) {
      const edit = addLeagueFixture(state, { teamId: 611, opponentId, venue: "HOME", dateUtc: null });
      assert.ok(edit.ok);
      state = edit.state;
    }
    const ninth = addLeagueFixture(state, { teamId: 611, opponentId: 1393, venue: "AWAY", dateUtc: null });
    assert.equal(!ninth.ok && ninth.error, "Fenerbahçe için 8 rakip zaten girildi.");
    const duplicate = addLeagueFixture(leagueEmpty, { teamId: 611, opponentId: 163, venue: "HOME", dateUtc: null });
    assert.ok(duplicate.ok);
    const twice = addLeagueFixture(duplicate.state, { teamId: 611, opponentId: 163, venue: "AWAY", dateUtc: null });
    assert.equal(!twice.ok && twice.error, "Borussia Mönchengladbach, Fenerbahçe için zaten girildi.");
    assert.equal(addTie(leagueEmpty, { first: 611, second: 211, firstLegUtc: null, secondLegUtc: null }).ok, false);
  });
});

describe("eksik eşleşmeyle üretim (yalnızca girilenler)", () => {
  it("A lig aşaması: 3 rakip girildiyse 3 hücre; özet girilenlere göre", () => {
    const partial = { ...DRAW_LEAGUE, fixtures: DRAW_LEAGUE.fixtures.filter((f) => f.teamId === 611).slice(0, 3) };
    const card = buildDrawCard({ ...input, variant: "TEAM", states: [partial], focusTeamId: 611 });
    assert.ok(card.ok);
    assert.equal(card.data.body.kind, "TEAM_LEAGUE");
    assert.equal(card.data.body.kind === "TEAM_LEAGUE" && card.data.body.cells.length, 3);
    assert.equal(card.data.body.kind === "TEAM_LEAGUE" && card.data.body.summary, "3 RAKİP · 2 İÇ SAHA · 1 DEPLASMAN");
  });

  it("C: 2 eşleşme girildiyse yalnızca 2 satır; 'kura sürüyor' etiketi yok", () => {
    const partial = { ...DRAW_KNOCKOUT, ties: DRAW_KNOCKOUT.ties.slice(0, 2) };
    const card = buildDrawCard({ ...input, variant: "ALL", states: [partial] });
    assert.ok(card.ok);
    assert.equal(card.data.body.kind === "ALL" && card.data.body.ties.length, 2);
    assert.ok(!JSON.stringify(card.data).toLocaleLowerCase("tr-TR").includes("sürüyor"));
  });

  it("odak takımın girişi yoksa okunur hata; C lig aşamasında reddedilir; B en fazla 5 takım", () => {
    const none = buildDrawCard({ ...input, variant: "TEAM", states: [knockoutEmpty], focusTeamId: 611 });
    assert.equal(!none.ok && none.error.message, "Fenerbahçe için eşleşme girilmedi.");
    assert.equal(buildDrawCard({ ...input, variant: "ALL", states: [DRAW_LEAGUE] }).ok, false);
    const b = buildDrawCard({ ...input, variant: "TURKISH", states: [DRAW_LEAGUE] });
    assert.ok(b.ok);
    assert.equal(b.data.body.kind === "TURKISH" && b.data.body.rows.length, 5);
  });

  it("A eleme: sıra ve tarih olgusu; Türk takımı C'de vurgulu", () => {
    const card = buildDrawCard({ ...input, variant: "TEAM", states: [DRAW_KNOCKOUT], focusTeamId: 645 });
    assert.ok(card.ok && card.data.body.kind === "TEAM_KNOCKOUT");
    if (card.data.body.kind !== "TEAM_KNOCKOUT") return;
    assert.equal(card.data.body.opponent.name, "FENERBAHÇE");
    assert.equal(card.data.body.order, "İLK MAÇ DEPLASMANDA");
    assert.equal(card.data.body.dates, "1. MAÇ 03.03 · 2. MAÇ 10.03");
    const all = buildDrawCard({ ...input, variant: "ALL", states: [DRAW_KNOCKOUT] });
    assert.ok(all.ok && all.data.body.kind === "ALL" && all.data.body.ties[0]?.highlight === true);
    assert.equal(all.ok && all.data.footerLine, "UEFA ŞAMPİYONLAR LİGİ · PLAY-OFF TURU · KURA 20.02.2027");
  });
});

describe("kura sonrası API karşılaştırması (otomatik düzeltme yok)", () => {
  it("eleme: API'de yok, girilmemiş, ilk maç yeri farklı", () => {
    const entered = { ...knockoutEmpty, ties: [{ first: 611, second: 211, firstLegUtc: null, secondLegUtc: null }, { first: 645, second: 549, firstLegUtc: null, secondLegUtc: null }] };
    const api = [
      { first: 211, second: 611, firstLegUtc: null, secondLegUtc: null },
      { first: 530, second: 40, firstLegUtc: null, secondLegUtc: null },
    ];
    assert.deepEqual(
      compareTies(entered, api).map((d) => d.text),
      ["Fenerbahçe – Benfica: API'de ilk maç Benfica sahasında", "Girilen eşleşme API'de yok: Galatasaray – Beşiktaş", "API'de var, girilmemiş: Atletico Madrid – Liverpool"],
    );
    assert.deepEqual(compareTies({ ...knockoutEmpty, ties: api }, api), []);
  });

  it("lig aşaması: yalnızca rakip girilen takımlar; iç saha/deplasman farkı", () => {
    const entered = { ...leagueEmpty, fixtures: [{ teamId: 611, opponentId: 163, venue: "HOME" as const, dateUtc: null }] };
    const api = [
      { teamId: 611, opponentId: 163, venue: "AWAY" as const, dateUtc: null },
      { teamId: 611, opponentId: 211, venue: "HOME" as const, dateUtc: null },
      { teamId: 645, opponentId: 40, venue: "HOME" as const, dateUtc: null },
    ];
    assert.deepEqual(compareLeague(entered, api).map((d) => d.kind), ["VENUE_SWAPPED", "MISSING_IN_ENTRY"]);
  });
});

describe("olgu satırı ve ad eşleme", () => {
  const fixture = (homeId: number, awayId: number, home: number, away: number, day: number, status = "FT"): ApiFootballFixtureRaw =>
    ({ fixture: { id: day, date: "", timestamp: Date.UTC(2020, 0, day) / 1000, status: { long: "", short: status, elapsed: 90 } }, league: { id: 2, name: "", country: "", season: 2020, round: "" }, teams: { home: { id: homeId, name: "", logo: "" }, away: { id: awayId, name: "", logo: "" } }, goals: { home, away } }) as unknown as ApiFootballFixtureRaw;

  it("geçmiş varsa '… daha önce N kez karşılaştı: 1G 1B 2M'; yoksa satır yok; bitmemiş maç sayılmaz", () => {
    const history = [fixture(611, 211, 1, 0, 1), fixture(211, 611, 1, 1, 2), fixture(211, 611, 2, 0, 3), fixture(611, 211, 0, 1, 4), fixture(611, 211, 0, 0, 5, "NS")];
    const record = headToHeadRecord(history, 611, "2027-01-01T00:00:00Z");
    assert.deepEqual(record, { played: 4, wins: 1, draws: 1, losses: 2 });
    assert.equal(headToHeadFact("Fenerbahçe", "Benfica", record), "Fenerbahçe ile Benfica daha önce 4 kez karşılaştı: 1G 1B 2M");
    assert.equal(headToHeadFact("Fenerbahçe", "Benfica", headToHeadRecord([], 611, "2027-01-01T00:00:00Z")), "");
  });

  it("Türk yayıncı adı; admin düzeltmesi kazanır; büyük harf yabancıda uluslararası, Türk takımında Türkçe", () => {
    assert.equal(cardTeamName("Bayern Munich"), "Bayern Münih");
    assert.equal(cardTeamName("Inter Milan"), "Inter");
    assert.equal(cardTeamName("Manchester United"), "Manchester United");
    assert.equal(cardTeamName("Borussia Monchengladbach"), "Borussia Mönchengladbach");
    assert.equal(drawTeamName({ ...DRAW_KNOCKOUT, nameOverrides: { 163: "Gladbach" } }, 163), "Gladbach");
    assert.equal(teamCard(DRAW_KNOCKOUT, 163, {}).name, "BORUSSIA MÖNCHENGLADBACH");
    assert.equal(teamCard(DRAW_KNOCKOUT, 505, {}).name, "INTER");
    assert.equal(teamCard(DRAW_KNOCKOUT, 549, {}).name, "BEŞİKTAŞ");
    assert.equal(dayMonth("2026-11-04T17:45:00Z"), "04.11");
  });

  it("API fikstüründen: eleme iki ayak tek eşleşme (ilk ayak ev sahibi first); lig aşaması iki taraf için", () => {
    const legs = [{ ...fixture(211, 611, 1, 0, 10), league: { round: "Round of 16" } }, { ...fixture(611, 211, 2, 0, 17), league: { round: "Round of 16" } }] as unknown as ApiFootballFixtureRaw[];
    assert.deepEqual(tiesFromApi(legs, /Round of 16/).map((t) => [t.first, t.second]), [[211, 611]]);
    const league = [{ ...fixture(611, 40, 0, 0, 4), league: { round: "League Stage - 4" } }] as unknown as ApiFootballFixtureRaw[];
    assert.deepEqual(leagueFixturesFromApi(league).map((f) => [f.teamId, f.opponentId, f.venue]), [[611, 40, "HOME"], [40, 611, "AWAY"]]);
  });
});

describe("boş kura", () => {
  it("emptyDraw takımsız ve eşleşmesiz başlar", () => {
    const state = emptyDraw({ competition: { id: 848, name: "UEFA Konferans Ligi" }, season: 2026, roundLabel: "Lig Aşaması", stage: "LEAGUE_PHASE", drawDateUtc: null });
    assert.deepEqual([state.teams, state.ties, state.fixtures], [[], [], []]);
  });
});
