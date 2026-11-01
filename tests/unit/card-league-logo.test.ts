import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { apiLeagueLogoUrl, chooseLeagueLogo, leagueIdFromLogoUrl } from "@/lib/dashboard/league-logo-source";
import { embedLeagueLogo } from "@/lib/dashboard/match-day-assets";

/**
 * Lig logosu (kurucu kararı 2026-11-01): yalnızca Haftanın Maçları, Puan Durumu ve Maç Günü. Kaynak önceliği: Medya
 * Kütüphanesi'nde o lig için yüklenen logo → API-Football logosu → yalnızca tipografik lig adı. Set kartları
 * (Maç Sonucu, İstatistikler) ve künye logosuz kalır (2026-10-29 kararı).
 */

const read = (path: string) => readFileSync(path, "utf8");

describe("lig logosu kaynak önceliği", () => {
  const api = apiLeagueLogoUrl(203);
  it("admin logosu → API-Football → boş (tipografik)", () => {
    assert.equal(chooseLeagueLogo("/api/files/library/a.png", api), "/api/files/library/a.png");
    assert.equal(chooseLeagueLogo(null, api), api);
    assert.equal(chooseLeagueLogo(null, ""), "");
    assert.equal(chooseLeagueLogo(undefined, undefined), "");
  });

  it("API-Football adresinden lig kimliği; başka adres kimlik vermez", () => {
    assert.equal(leagueIdFromLogoUrl(api), 203);
    assert.equal(leagueIdFromLogoUrl("https://example.com/football/leagues/203.png"), null);
    assert.equal(leagueIdFromLogoUrl(""), null);
    assert.equal(leagueIdFromLogoUrl(undefined), null);
  });

  it("gömme: boş ve izinsiz adres çizilmez (SSRF); hazır görsel aynen", async () => {
    assert.equal(await embedLeagueLogo("", 300), null);
    assert.equal(await embedLeagueLogo(undefined, 300), null);
    assert.equal(await embedLeagueLogo("https://example.com/logo.png", 300), null);
    assert.equal(await embedLeagueLogo("http://localhost/api/files/library/a.png", 300), null);
    assert.equal(await embedLeagueLogo("data:image/png;base64,AAAA", 300), "data:image/png;base64,AAAA");
  });
});

describe("hangi kartlarda lig logosu var", () => {
  it("üç kart: motor kaynak zincirini, çizim gömmeyi kullanır", () => {
    for (const file of ["src/lib/dashboard/weekly-fixtures-engine.ts", "src/lib/dashboard/standings-engine.ts", "src/lib/dashboard/match-day-engine.ts"]) assert.match(read(file), /preferredLeagueLogo\(/, file);
    assert.match(read("src/lib/dashboard/weekly-fixtures-render.tsx"), /embedLeagueLogo\(input\.leagueLogoUrl/);
    assert.match(read("src/lib/dashboard/standings-render.tsx"), /embedLeagueLogo\(input\.leagueLogoUrl/);
    assert.match(read("src/lib/dashboard/match-day-assets.ts"), /embedLeagueLogo\(params\.leagueLogo/);
    assert.match(read("src/lib/dashboard/match-day-fixtures.ts"), /leagueLogoUrl: fixture\.competition\.logoUrl/);
  });

  it("Maç Günü: üç şablon da aynı plakayı çizer", () => {
    for (const template of ["premium-broadcast", "data-driven", "editorial-portrait"]) {
      assert.match(read(`src/skills/render-engine/templates/match-day/${template}.tsx`), /<LeagueMark card=\{card\}/, template);
    }
  });

  it("set kartları (Maç Sonucu, İstatistikler): leagueLogo her zaman null", () => {
    const source = read("src/lib/dashboard/checkmatch-set.ts");
    assert.match(source, /leagueLogo: null/);
    assert.doesNotMatch(source, /preferredLeagueLogo|embedLeagueLogo|findLeagueLogoUrl|competition\.logoUrl/);
  });

  it("lig adı logoyla birlikte de tipografik yazılır", () => {
    // Lig adı köken kuralıyla büyür (yabancı lig "SERIE A", Türkçe "SÜPER LİG") — bkz. name-case.ts::upperCompetition.
    assert.match(read("src/skills/render-engine/templates/weekly-fixtures/weekly-fixtures.tsx"), /upperCompetition\(leagueName\)/);
    assert.match(read("src/skills/render-engine/templates/standings/standings-card.tsx"), /upperCompetition\(leagueName\)/);
    assert.match(read("src/skills/render-engine/templates/match-day/shared.tsx"), /card\.leagueLabel/);
  });
});
