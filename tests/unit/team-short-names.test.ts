import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { cardTeamName } from "@/lib/archive/names";
import { upperTeamName } from "@/lib/dashboard/name-case";
import { TEAM_NAME_FORMS, teamNameFor } from "@/lib/names/team-name-forms";
import { SHORT_MAX, TEAM_SHORT_NAMES, ruleShortName, shortTeamName } from "@/lib/names/team-short-names";

/**
 * Takım kısa adı (canlı test 2026-10-31: "Borussia Mönchengladbach" Vitrin 02'yi, Gaziantep FK Vitrin 01 çubuk
 * etiketini taşırdı). Tablo → kural → ad; hangi alan hangi biçim `team-name-forms.ts`.
 */

const INTL = { name: "intl", people: "intl" } as const;
const read = (file: string) => readFileSync(path.join(process.cwd(), file), "utf8");

describe("takım kısa adı", () => {
  it("yayıncı tablosu: Gladbach, Paderborn, Karagümrük", () => {
    assert.equal(shortTeamName(cardTeamName("Borussia Monchengladbach")), "M'gladbach");
    assert.equal(shortTeamName("SC Paderborn 07"), "Paderborn");
    assert.equal(shortTeamName("Fatih Karagümrük"), "Karagümrük");
    assert.equal(upperTeamName(shortTeamName("Borussia Mönchengladbach"), INTL), "M'GLADBACH");
  });

  it("kısa ad tablosundaki her ad gerçekten kısa", () => {
    for (const [name, short] of Object.entries(TEAM_SHORT_NAMES)) assert.ok(short.length <= SHORT_MAX, `${name} → ${short}`);
  });

  it("kural: uzun adda kulüp ön/son eki düşer, kısa ad olduğu gibi", () => {
    assert.equal(ruleShortName("Borussia Dortmund"), "Dortmund");
    assert.equal(ruleShortName("1. FC Kaiserslautern"), "Kaiserslautern");
    assert.equal(ruleShortName("Olympique Lyonnais FC"), "Lyonnais");
    assert.equal(ruleShortName("Real Valladolid"), "Valladolid");
    assert.equal(ruleShortName("Gaziantep FK"), "Gaziantep FK");
    assert.equal(ruleShortName("Galatasaray"), "Galatasaray");
    assert.equal(ruleShortName("Real Madrid"), "Real Madrid");
    // Ek atılınca ad kalmıyorsa (tek sözcük) ad korunur.
    assert.equal(ruleShortName("FC"), "FC");
  });
});

describe("takım ad biçimleri", () => {
  it("tablo sabit: poster/başlık uzun, dar kutu kısa", () => {
    assert.deepEqual(TEAM_NAME_FORMS, {
      VITRIN_POSTER_TEAMS: "long",
      VITRIN_BAR_LABELS: "short",
      VITRIN_FORM_ROWS: "long",
      VITRIN_GAUGE_LABEL: "short",
      VITRIN_CAPTION: "long",
      MATCH_ANALYSIS_TEAMS_ROW: "short",
      MATCH_ANALYSIS_FACTS: "long",
    });
    assert.equal(teamNameFor("VITRIN_POSTER_TEAMS", "Borussia Mönchengladbach"), "Borussia Mönchengladbach");
    assert.equal(teamNameFor("VITRIN_BAR_LABELS", "Borussia Mönchengladbach"), "M'gladbach");
  });

  it("kısa yuvalar kodda tablodan okunur", () => {
    const vitrin = read("src/lib/dashboard/vitrin-card.ts");
    assert.match(vitrin, /teamNameFor\("VITRIN_BAR_LABELS"/);
    assert.match(vitrin, /teamNameFor\("VITRIN_GAUGE_LABEL"/);
    assert.match(read("src/lib/dashboard/match-analysis-card.ts"), /teamNameFor\("MATCH_ANALYSIS_TEAMS_ROW"/);
    assert.match(read("src/skills/render-engine/templates/vitrin/poster.tsx"), /card\.shortTeams\.home/);
  });
});
