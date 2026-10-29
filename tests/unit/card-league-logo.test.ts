import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

/**
 * Lig/turnuva logosu hiçbir kartta kullanılmaz (2026-10-29, Kura kararıyla tutarlı): kart verisini üreten her
 * kaynak lig logosunu boş verir; şablonlar logo yokken lig adını tipografik yazar (künye / üst satır).
 */

const read = (path: string) => readFileSync(path, "utf8");

describe("kartlarda lig logosu yok", () => {
  it("set kartları (Maç Sonucu, İstatistikler): leagueLogo her zaman null", () => {
    const source = read("src/lib/dashboard/checkmatch-set.ts");
    assert.match(source, /leagueLogo: null/);
    assert.doesNotMatch(source, /resolveLeagueLogo|findLeagueLogoUrl|competition\.logoUrl/);
  });

  it("Maç Günü: form lig logosu göndermez, çizim de çözmez", () => {
    assert.match(read("src/lib/dashboard/match-day-fixtures.ts"), /leagueLogoUrl: "",/);
    assert.doesNotMatch(read("src/lib/dashboard/match-day-assets.ts"), /resolveImage\(params\.leagueLogo/);
  });

  it("Haftanın Maçları ve Puan Durumu: lig logosu gömülmez", () => {
    for (const file of ["src/lib/dashboard/weekly-fixtures-render.tsx", "src/lib/dashboard/standings-render.tsx"]) {
      assert.doesNotMatch(read(file), /embedLogo\(input\.leagueLogoUrl/, file);
    }
  });

  it("lig adı tipografik: üst satırda lig adı yazılır", () => {
    // Lig adı köken kuralıyla büyür (yabancı lig "SERIE A", Türkçe "SÜPER LİG") — bkz. name-case.ts::upperCompetition.
    assert.match(read("src/skills/render-engine/templates/weekly-fixtures/weekly-fixtures.tsx"), /upperCompetition\(leagueName\)/);
    assert.match(read("src/skills/render-engine/templates/standings/standings-card.tsx"), /upperCompetition\(leagueName\)/);
    assert.match(read("src/skills/render-engine/templates/match-day/shared.tsx"), /card\.leagueLabel/);
  });
});
