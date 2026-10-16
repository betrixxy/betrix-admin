import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildMatchResultCaption, matchResultTitle } from "@/lib/dashboard/match-result-caption";
import { featuredSlots, mvpOf } from "@/lib/dashboard/match-result-featured";
import { toMatchResultFacts } from "@/lib/services/api-football/match-result-mappers";
import type { ApiFootballFixtureResultRaw } from "@/lib/services/api-football/types";
import {
  buildMatchResultBackgroundPrompt,
  buildMatchResultHarmonizePrompt,
  VICTORY_EDIT_BLOCK,
  type MatchResultPromptInput,
} from "@/lib/services/fal/match-result-prompts";
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

describe("öne çıkan oyuncu yuvaları", () => {
  it("galibiyette tek yuva: öneri MVP, kazanan takımın oyuncuları listede önce", () => {
    const slots = featuredSlots(WIN);
    assert.equal(slots.length, 1);
    assert.equal(slots[0]?.defaultPlayerId, 34710);
    assert.equal(slots[0]?.options[0]?.side, "AWAY");
    assert.ok(slots[0]?.options.some((option) => option.side === "HOME"), "MVP iki takımdan da değiştirilebilir");
  });

  it("beraberlikte iki yuva (ev sahibi solda, deplasman sağda), her biri kendi takımının en yüksek rating'i", () => {
    const slots = featuredSlots(factsOf(DRAW_RAW));
    assert.deepEqual(slots.map((slot) => slot.key), ["player1", "player2"]);
    assert.ok(slots[0]?.options.every((option) => option.side === "HOME"));
    assert.ok(slots[1]?.options.every((option) => option.side === "AWAY"));
    assert.deepEqual(slots.map((slot) => slot.defaultPlayerId), [202501, 34710]);
  });

  it("penaltılarla kazanılan maç galibiyet sayılır (tek MVP)", () => {
    const facts = factsOf(PEN_RAW);
    assert.equal(facts.outcome, "HOME");
    assert.equal(featuredSlots(facts).length, 1);
    assert.equal(matchResultTitle(facts), "Hoffenheim 2-2 Beşiktaş (P 4-3)");
  });

  it("karttaki maçın oyuncusu: seçilenlerden rating'i yüksek olan", () => {
    const [home, away] = [WIN.players.find((p) => p.side === "HOME"), WIN.players.find((p) => p.side === "AWAY")];
    assert.ok(home && away);
    assert.equal(mvpOf([home, away])?.playerId, 34710);
    assert.equal(mvpOf([]), null);
  });

  it("oyuncu havuzu rating'e göre azalan", () => {
    const ratings = WIN.players.map((player) => player.rating ?? 0);
    assert.deepEqual(ratings, [...ratings].sort((a, b) => b - a));
  });
});

describe("Maç Sonucu prompt'ları", () => {
  const base: MatchResultPromptInput = { mood: "WIN", importance: "NORMAL", primaryColorHex: "#111111", secondaryColorHex: "#1d4ed8" };

  it("galibiyet ve beraberlik farklı sahne; hex yerine renk adı; insan figürü/metin yok", () => {
    const win = buildMatchResultBackgroundPrompt(base);
    const draw = buildMatchResultBackgroundPrompt({ ...base, mood: "DRAW" });
    assert.match(win, /celebrating/);
    assert.match(draw, /calm and balanced/);
    assert.match(win, /fans in black/);
    assert.doesNotMatch(win + draw, /#[0-9a-f]{6}/i);
    assert.match(win, /no people in the foreground, no text/);
  });

  it("maç önemi tribün yoğunluğunu belirler", () => {
    assert.match(buildMatchResultBackgroundPrompt({ ...base, importance: "BIG_DERBY" }), /choreography/);
    assert.match(buildMatchResultBackgroundPrompt({ ...base, importance: "FINAL_CRITICAL" }), /decisive/);
  });

  it("galibiyet eki yalnızca galibiyette; yüz ve ifade korunur", () => {
    assert.ok(buildMatchResultHarmonizePrompt(base).includes(VICTORY_EDIT_BLOCK));
    assert.ok(!buildMatchResultHarmonizePrompt({ ...base, mood: "DRAW" }).includes(VICTORY_EDIT_BLOCK));
    assert.match(VICTORY_EDIT_BLOCK, /facial expression exactly unchanged/);
  });

  it("ek yönerge sona eklenir", () => {
    assert.match(buildMatchResultBackgroundPrompt({ ...base, customPrompt: "rainy night" }), /Additional direction: rainy night$/);
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
  });
});
