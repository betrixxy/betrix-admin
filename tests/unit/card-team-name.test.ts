import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { cardTeamName, officialTeamName } from "@/lib/archive/names";
import { teamCard } from "@/lib/dashboard/draw-card";
import { toStandingRow } from "@/lib/services/api-football/standings-mappers";
import type { DrawState } from "@/types/draw";

/**
 * Kart takım adı TEK KAYNAK (`archive/names.ts::cardTeamName`): bütün kartlar aynı adı yazar
 * ("Slavia Praha" hiçbir kartta "Slavia Praha" kalmaz). Arşiv klasör adı ayrı kuralla kalır.
 */

describe("kart takım adı — tek kaynak", () => {
  it("Avrupa yayıncı adı, Türkçe eşleme, API adı sırası", () => {
    assert.equal(cardTeamName("Slavia Praha"), "Slavia Prag");
    assert.equal(cardTeamName(" Besiktas "), "Beşiktaş");
    assert.equal(cardTeamName("Bayern Munich"), "Bayern Münih");
    assert.equal(cardTeamName("Unknown FC"), "Unknown FC");
  });

  it("API-Football /teams adları (2026/27 Avrupa kupaları): Türk yayıncı kullanımı, Türkçe karşılık Türkçe büyük harfle", () => {
    assert.equal(cardTeamName("Bayern München"), "Bayern Münih");
    assert.equal(cardTeamName("Dynamo Kyiv"), "Dinamo Kiev");
    assert.equal(cardTeamName("Qarabag"), "Karabağ");
    const card = (apiName: string, country: string) => teamCard({ teams: [{ id: 1, apiName, country, logoUrl: null, pot: null }], nameOverrides: {} } as unknown as DrawState, 1, {}).name;
    assert.equal(card("Bayern München", "Germany"), "BAYERN MÜNİH");
    assert.equal(card("Dynamo Kyiv", "Ukraine"), "DİNAMO KİEV");
    assert.equal(card("Rapid Vienna", "Austria"), "RAPİD VİYANA");
    assert.equal(card("Villarreal", "Spain"), "VILLARREAL");
    assert.equal(card("Borussia Monchengladbach", "Germany"), "BORUSSIA MÖNCHENGLADBACH");
  });

  it("puan durumu eşlemesi kart adını kullanır", () => {
    const row = toStandingRow({ rank: 1, team: { id: 560, name: "Slavia Praha", logo: "" }, points: 0, goalsDiff: 0, form: null, all: { played: 0, win: 0, draw: 0, lose: 0, goals: { for: 0, against: 0 } } } as unknown as Parameters<typeof toStandingRow>[0]);
    assert.equal(row.teamName, "Slavia Prag");
  });

  it("eski `teamNameTr` yolu kalmadı — kart adı başka tablodan okunmaz", () => {
    const labels = readFileSync("src/lib/dashboard/match-result-labels.ts", "utf8");
    assert.ok(!/teamNameTr|TEAM_NAMES_TR/.test(labels));
  });

  it("arşiv klasör adı Avrupa yayıncı adından etkilenmez", () => {
    assert.equal(officialTeamName(560, "Slavia Praha"), "Slavia Praha");
    assert.equal(officialTeamName(549, "Besiktas"), "Beşiktaş JK");
  });
});
