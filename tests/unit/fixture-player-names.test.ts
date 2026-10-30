import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { namedEvent } from "@/lib/match-analysis/names";
import { nameFor } from "@/lib/names/card-name-forms";
import { cardNameInTeams, cardPlayerNames, type TeamPeople } from "@/lib/names/person-name";
import { namedResultFacts } from "@/lib/names/result-people";
import { namedScorerLines } from "@/lib/names/scorer-names";
import { assemblePlayerStatsFacts } from "@/lib/player-stats/assemble";
import { toAnalysisEvents } from "@/lib/services/api-football/analysis-events-mappers";
import { fixturePlayerNames, withFixturePlayerNames } from "@/lib/services/api-football/fixture-player-names";
import { isOwnGoalLine, toMatchResultFacts } from "@/lib/services/api-football/match-result-mappers";
import { squadPeople } from "@/lib/services/sportmonks/people-mappers";
import type { MatchSide } from "@/types/match-result";
import type { CardPersonName } from "@/types/person-name";
import { RAW_MILAN_BOLOGNA, SM_SQUAD_BOLOGNA, SM_SQUAD_MILAN } from "../fixtures/api-football/milan-bologna";

/**
 * BEKÇİ (canlı test 2026-10-31, madde 9): aynı maçta bir oyuncunun BÜTÜN kartlardaki adı aynı. AC Milan 2-4
 * Bologna gerçek yanıtı: olay akışı hat-trick'i "Samuel Mbangula Tshifunda" verir, oyuncu bloğu "S. Mbangula".
 * Eskiden golcü satırı (Maç Sonucu, İstatistik 02) ve Maç Analizi "S. TSHIFUNDA", oyuncu kartları
 * "S. MBANGULA" yazıyordu. Karşılaştırılan: yolların çözdüğü `CardPersonName` (büyük harf/kısa biçim değil) ve
 * her yolun yazdığı ad = aynı yuvanın `nameFor` çıktısı.
 */

const people = (squad: unknown): TeamPeople => {
  const list = squadPeople(squad);
  if (!list) throw new Error("Sabit Sportmonks kadrosu şemaya uymuyor");
  return { people: list, overrides: new Map(), teamHint: "intl" };
};
const MILAN = people(SM_SQUAD_MILAN);
const BOLOGNA = people(SM_SQUAD_BOLOGNA);
const teamsOf = (side: MatchSide): TeamPeople => (side === "HOME" ? MILAN : BOLOGNA);
const otherOf = (side: MatchSide): TeamPeople => (side === "HOME" ? BOLOGNA : MILAN);

/** (taraf, oyuncu kimliği) → her yolun çözdüğü kart adları. */
const resolved = new Map<string, { path: string; card: CardPersonName }[]>();
function record(path: string, side: MatchSide, playerId: number | null, apiName: string, ownGoal = false): CardPersonName {
  const own = teamsOf(side);
  const card = cardNameInTeams({ apiId: playerId, apiName }, ownGoal ? [otherOf(side), own] : [own]);
  if (playerId !== null) {
    // KK golcüsü rakipten: oyuncunun kendi takımına yazılır.
    const key = `${ownGoal ? (side === "HOME" ? "AWAY" : "HOME") : side}:${playerId}`;
    resolved.set(key, [...(resolved.get(key) ?? []), { path, card }]);
  }
  return card;
}

const facts = toMatchResultFacts(RAW_MILAN_BOLOGNA);
assert.ok(facts, "Milan–Bologna bitmiş maç");

describe("maçın tek oyuncu adı — fixture-player-names.ts", () => {
  it("oyuncu bloğu > ilk 11 > olay adı; olaylar maçın adına çevrilir", () => {
    const names = fixturePlayerNames(RAW_MILAN_BOLOGNA);
    assert.equal(names.get(346866), "S. Mbangula");
    const events = withFixturePlayerNames(RAW_MILAN_BOLOGNA).events;
    assert.ok(events.filter((event) => event.player.id === 346866).every((event) => event.player.name === "S. Mbangula"));
    assert.ok(RAW_MILAN_BOLOGNA.events.some((event) => event.player.name === "Samuel Mbangula Tshifunda"), "sabit yanıt değiştirilmez");
  });
});

describe("BEKÇİ: aynı maçta aynı oyuncu bütün kartlarda aynı adla", () => {
  it("Maç Sonucu golcüleri + MVP, İstatistik 02 golcüleri, Oyuncu İst. A/B, Maç Analizi zaman çizelgesi", () => {
    // Maç Sonucu (01): golcüler + MVP adayları (`withResultPeople` yolu).
    const result = namedResultFacts(facts, MILAN, BOLOGNA).facts;
    for (const side of ["HOME", "AWAY"] as const) {
      const lines = side === "HOME" ? facts.home.scorers : facts.away.scorers;
      const named = side === "HOME" ? result.home.scorers : result.away.scorers;
      lines.forEach((line, index) => {
        const card = record("01 golcü", side, line.playerId, line.name, isOwnGoalLine(line));
        assert.equal(named[index]?.name, nameFor("SET_SCORERS", card));
      });
    }
    for (const player of facts.players) {
      const card = record("01 MVP", player.side, player.playerId, player.name);
      assert.equal(result.players.find((candidate) => candidate.playerId === player.playerId)?.name, nameFor("MATCH_RESULT_MVP", card));
    }
    // İstatistik 02 (`withSetPeople` yolu).
    const stats = { home: namedScorerLines(facts.home, MILAN, BOLOGNA), away: namedScorerLines(facts.away, BOLOGNA, MILAN) };
    assert.deepEqual(stats.away.scorers, result.away.scorers);
    assert.deepEqual(stats.home.scorers, result.home.scorers);

    // Oyuncu İstatistikleri A/B (`playerCardNames` → `resolvePlayerNames` yolu).
    const playerFacts = assemblePlayerStatsFacts(RAW_MILAN_BOLOGNA, new Date("2026-10-31T12:00:00Z"), null);
    assert.ok(playerFacts);
    for (const side of ["HOME", "AWAY"] as const) {
      const lines = playerFacts.lines.filter((line) => line.side === side);
      const cards = cardPlayerNames(lines.map((line) => ({ apiId: line.playerId, apiName: line.name })), teamsOf(side));
      lines.forEach((line, index) => {
        const card = record("Oyuncu İst.", side, line.playerId, line.name);
        assert.deepEqual(cards[index], card);
      });
    }

    // Maç Analizi 01 zaman çizelgesi.
    for (const event of toAnalysisEvents(RAW_MILAN_BOLOGNA)) {
      const named = namedEvent(event, { home: MILAN, away: BOLOGNA });
      if (event.player) {
        const card = record("Analiz", event.side, event.player.playerId, event.player.name, event.kind === "OWN_GOAL");
        assert.equal(named.player?.name, nameFor("MATCH_ANALYSIS_EVENTS", card));
      }
      if (event.related) record("Analiz giren", event.side, event.related.playerId, event.related.name);
    }

    // Her oyuncu için bütün yolların CardPersonName'i aynı.
    for (const [key, entries] of resolved) {
      for (const entry of entries) assert.deepEqual(entry.card, entries[0]!.card, `${key}: ${entry.path} ≠ ${entries[0]!.path}`);
    }
    const mbangula = resolved.get("AWAY:346866");
    assert.ok(mbangula && mbangula.length >= 4, "Mbangula golcü, MVP, oyuncu kartı ve zaman çizelgesinde");
    assert.equal(mbangula[0]!.card.short, "S. Mbangula");
    assert.equal(mbangula[0]!.card.name, "Samuel Mbangula");
  });

  it("hat-trick satırı kısa biçimde S. Mbangula (TSHIFUNDA değil)", () => {
    const line = namedScorerLines(facts.away, BOLOGNA, MILAN).scorers.find((scorer) => scorer.playerId === 346866);
    assert.equal(line?.name, "S. Mbangula");
    assert.deepEqual(line?.minutes, ["8'", "62'", "86'"]);
  });
});
