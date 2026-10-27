import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { cardTeamName, officialTeamName } from "@/lib/archive/names";
import { toStandingRow } from "@/lib/services/api-football/standings-mappers";

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
