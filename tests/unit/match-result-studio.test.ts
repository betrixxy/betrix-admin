import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { captionFormatGate } from "@/lib/dashboard/caption-format";
import { buildMatchResultCaption, matchResultTitle } from "@/lib/dashboard/match-result-caption";
import { mvpLineName, mvpOptions } from "@/lib/dashboard/match-result-featured";
import { toMatchResultFacts } from "@/lib/services/api-football/match-result-mappers";
import type { ApiFootballFixtureResultRaw } from "@/lib/services/api-football/types";
import type { MatchResultFacts } from "@/types/match-result";
import { RAW_HOFFENHEIM_BESIKTAS } from "../fixtures/api-football/match-result";

function factsOf(raw: ApiFootballFixtureResultRaw): MatchResultFacts {
  const facts = toMatchResultFacts(raw);
  assert.ok(facts);
  return facts;
}

const WIN = factsOf(RAW_HOFFENHEIM_BESIKTAS);
const DRAW_RAW: ApiFootballFixtureResultRaw = {
  ...RAW_HOFFENHEIM_BESIKTAS,
  teams: { home: { ...RAW_HOFFENHEIM_BESIKTAS.teams.home, winner: null }, away: { ...RAW_HOFFENHEIM_BESIKTAS.teams.away, winner: null } },
  goals: { home: 2, away: 2 },
};
const PEN_RAW: ApiFootballFixtureResultRaw = {
  ...DRAW_RAW,
  fixture: { ...RAW_HOFFENHEIM_BESIKTAS.fixture, status: { long: "Match Finished", short: "PEN", elapsed: 120 } },
  teams: { home: { ...DRAW_RAW.teams.home, winner: true }, away: { ...DRAW_RAW.teams.away, winner: false } },
  score: { penalty: { home: 4, away: 3 } },
};

describe("maçın oyuncusu", () => {
  it("MVP seçenekleri: kazanan takımın oyuncuları önce, iki takımdan da seçilebilir", () => {
    const options = mvpOptions(WIN);
    assert.equal(options[0]?.side, "AWAY");
    assert.ok(options.some((option) => option.side === "HOME"));
    assert.equal(WIN.mvp?.playerId, 34710);
  });

  it("beraberlikte havuz olduğu gibi (rating'e göre azalan)", () => {
    const draw = factsOf(DRAW_RAW);
    const ratings = mvpOptions(draw).map((player) => player.rating ?? 0);
    assert.deepEqual(ratings, [...ratings].sort((a, b) => b - a));
  });

  it("penaltılarla kazanılan maç galibiyet sayılır", () => {
    const facts = factsOf(PEN_RAW);
    assert.equal(facts.outcome, "HOME");
    assert.equal(mvpOptions(facts)[0]?.side, "HOME");
    assert.equal(matchResultTitle(facts), "Hoffenheim 2-2 Beşiktaş (P 4-3)");
  });

  it("MAÇIN OYUNCUSU satırı yalnızca fotoğraf etiketi MVP ile eşleşirse ya da kutucuk işaretliyse", () => {
    const mvp = { playerId: 34710, name: "Oh Hyeon-Gyu" };
    assert.equal(mvpLineName({ mvp, photoPlayerId: 34710, photoIsMvp: false }), "Oh Hyeon-Gyu");
    assert.equal(mvpLineName({ mvp, photoPlayerId: null, photoIsMvp: true }), "Oh Hyeon-Gyu");
    assert.equal(mvpLineName({ mvp, photoPlayerId: 999, photoIsMvp: true }), "Oh Hyeon-Gyu");
    assert.equal(mvpLineName({ mvp, photoPlayerId: null, photoIsMvp: false }), null);
    assert.equal(mvpLineName({ mvp, photoPlayerId: 999, photoIsMvp: false }), null);
    assert.equal(mvpLineName({ mvp: null, photoPlayerId: 34710, photoIsMvp: true }), null);
  });
});

describe("gönderi metni", () => {
  it("skor, turnuva, golcüler ve maçın oyuncusu — gerçek veriden", () => {
    assert.equal(
      buildMatchResultCaption(WIN, "Oh Hyeon-Gyu"),
      [
        "MAÇ SONUCU | Hoffenheim 2-3 Beşiktaş",
        "UEFA Avrupa Ligi · Lig Aşaması · 2. Maç",
        "⚽ Hoffenheim: Fisnik Asllani 68' · Koki Machida 87'",
        "⚽ Beşiktaş: Amir Murillo 60' · Oh Hyeon-gyu 72', 79'",
        "⭐ Maçın oyuncusu: Oh Hyeon-Gyu",
      ].join("\n"),
    );
    assert.equal(captionFormatGate(buildMatchResultCaption(WIN, "Oh Hyeon-Gyu")), null);
  });
});
