import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { competitionName } from "@/lib/dashboard/match-result-labels";
import { upperCompetition } from "@/lib/dashboard/name-case";
import { DRAW_COMPETITIONS } from "@/lib/draw/rounds";
import { COMPETITION_NAMES } from "@/lib/names/competition-names";
import { leagueDisplay } from "@/lib/player-h2h/names";
import { SUPPORTED_LEAGUES } from "@/lib/services/api-football/leagues";

/**
 * Lig / turnuva kart adı TEK KAYNAK (kurucu kararı 2026-10-30, Türkçe yayıncı adı): `competition-names.ts`.
 * Denetimde iki tablo vardı ("PREMİER LİG" / "PREMIER LEAGUE"). Bekçi: tablo sabit, bütün tüketiciler
 * aynı adı okur, kart kodunda elle yazılmış lig adı kalmaz.
 */

const ROOT = process.cwd();

/** Kart üreten kod (kartın künyesi, başlığı ve gönderi metni buradan çıkar). */
const CARD_DIRS = ["src/lib/dashboard", "src/lib/draw", "src/lib/player-h2h", "src/lib/player-stats", "src/lib/prediction", "src/lib/services/api-football", "src/skills/render-engine", "src/lib/archive"];

function files(dir: string): string[] {
  return readdirSync(path.join(ROOT, dir)).flatMap((entry) => {
    const rel = path.join(dir, entry);
    return statSync(path.join(ROOT, rel)).isDirectory() ? files(rel) : /\.tsx?$/u.test(entry) ? [rel] : [];
  });
}

/** Yorumlar atılır (belge örnekleri serbest); yalnızca kod satırlarındaki dizgiler aranır. */
const code = (source: string) => source.replace(/\/\*[\s\S]*?\*\//gu, "").replace(/(^|[^:])\/\/.*$/gmu, "$1");

describe("lig adı — tek kaynak", () => {
  it("tablo sabit (Türkçe yayıncı adı)", () => {
    assert.deepEqual(
      Object.fromEntries(Object.entries(COMPETITION_NAMES).map(([id, names]) => [id, names.name])),
      { 2: "UEFA Şampiyonlar Ligi", 3: "UEFA Avrupa Ligi", 39: "Premier Lig", 61: "Ligue 1", 78: "Bundesliga", 135: "Serie A", 140: "LaLiga", 203: "Trendyol Süper Lig", 204: "Trendyol 1. Lig", 206: "Ziraat Türkiye Kupası", 848: "UEFA Konferans Ligi" },
    );
  });

  it("tüketiciler aynı adı okur: Desteklenen Ligler, set künyesi, H2H, Kura", () => {
    for (const league of SUPPORTED_LEAGUES) assert.equal(league.name, COMPETITION_NAMES[league.apiFootballId]?.name, league.id);
    assert.equal(competitionName(39, "OTHER", "Premier League"), "Premier Lig");
    assert.equal(upperCompetition(competitionName(39, "OTHER", "Premier League")), "PREMİER LİG");
    assert.equal(upperCompetition(competitionName(135, "OTHER", "Serie A")), "SERIE A");
    assert.equal(leagueDisplay(39, "Premier League").label, "PREMİER LİG");
    assert.deepEqual(DRAW_COMPETITIONS.map((cup) => cup.short), ["Şampiyonlar Ligi", "Avrupa Ligi", "Konferans Ligi"]);
    assert.equal(competitionName(999, "OTHER", "Eredivisie"), "Eredivisie");
  });

  it("kart kodunda elle yazılmış lig adı yok", () => {
    const names = [...new Set(Object.values(COMPETITION_NAMES).flatMap((entry) => [entry.name, entry.short]))];
    const variants = ["Premier League", "La Liga", "PREMİER LİG", "PREMIER LEAGUE", "ŞAMPİYONLAR LİGİ", "AVRUPA LİGİ", "KONFERANS LİGİ", "SÜPER LİG"];
    const found: string[] = [];
    for (const file of CARD_DIRS.flatMap(files)) {
      if (file.endsWith("competition-names.ts")) continue;
      const literals = code(readFileSync(path.join(ROOT, file), "utf8")).match(/"[^"\n]*"|`[^`]*`/gu) ?? [];
      for (const literal of literals) {
        const hit = [...names, ...variants].find((name) => literal.includes(name));
        if (hit) found.push(`${file}: ${literal}`);
      }
    }
    assert.deepEqual(found, []);
  });
});
