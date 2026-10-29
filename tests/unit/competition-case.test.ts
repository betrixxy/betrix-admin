import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { competitionOrigin, upperCompetition, upperLabelLine } from "@/lib/dashboard/name-case";
import { suspiciousAccent } from "@/lib/names/accent-check";

/**
 * Lig/turnuva adı büyük harfi (2026-10-29: Maç Sonucu künyesinde "SERİE A"): Türkçe ad Türkçe, yabancı ad
 * uluslararası kuralla. Aksan şüphesi (API "Cissè") — yalnızca rapor, otomatik düzeltme yok.
 */

describe("lig / turnuva adı büyük harfi", () => {
  it("yabancı lig adları noktalı İ almaz", () => {
    assert.equal(upperCompetition("Serie A"), "SERIE A");
    assert.equal(upperCompetition("LaLiga"), "LALIGA");
    assert.equal(upperCompetition("Bundesliga"), "BUNDESLIGA");
    assert.equal(upperCompetition("Ligue 1"), "LIGUE 1");
    assert.equal(upperCompetition("Premier League"), "PREMIER LEAGUE");
    assert.equal(upperCompetition("UEFA Nations League"), "UEFA NATIONS LEAGUE");
  });

  it("Türkçe lig/turnuva adları Türkçe büyük harfle kalır", () => {
    assert.equal(upperCompetition("Trendyol Süper Lig"), "TRENDYOL SÜPER LİG");
    assert.equal(upperCompetition("Trendyol 1. Lig"), "TRENDYOL 1. LİG");
    assert.equal(upperCompetition("UEFA Şampiyonlar Ligi"), "UEFA ŞAMPİYONLAR LİGİ");
    assert.equal(upperCompetition("UEFA Avrupa Ligi"), "UEFA AVRUPA LİGİ");
    assert.equal(upperCompetition("UEFA Konferans Ligi"), "UEFA KONFERANS LİGİ");
    assert.equal(upperCompetition("Ziraat Türkiye Kupası"), "ZİRAAT TÜRKİYE KUPASI");
    assert.equal(upperCompetition("Premier Lig"), "PREMİER LİG", "Türkçe karşılıkla yazılan ad Türkçe");
    assert.equal(competitionOrigin("Süper Lig"), "tr");
  });

  it("künye satırı parça parça: lig adı kendi kökeni, tarih/saat etkilenmez", () => {
    assert.equal(upperLabelLine("Serie A · 30.10 · 20:00"), "SERIE A · 30.10 · 20:00");
    assert.equal(upperLabelLine("Trendyol Süper Lig · 30.10 · 20:00"), "TRENDYOL SÜPER LİG · 30.10 · 20:00");
  });

  it("kart kaynaklarında lig adı doğrudan Türkçe büyütülmez (upperCompetition'dan geçer)", () => {
    const walk = (dir: string): string[] =>
      readdirSync(dir).flatMap((entry) => {
        const full = path.join(dir, entry);
        return statSync(full).isDirectory() ? walk(full) : /\.(ts|tsx)$/.test(entry) ? [full] : [];
      });
    const files = ["src/lib/dashboard", "src/skills/render-engine/templates"].flatMap((dir) => walk(dir));
    const offenders = files.flatMap((file) =>
      readFileSync(file, "utf8")
        .split("\n")
        .map((line, index) => ({ line, index }))
        .filter(({ line }) => /(upperTr|upper)\((?:[a-zA-Z.]*\.)?(competition\.name|competitionName|leagueName|league\b|params\.league)|competition\.name\.toLocaleUpperCase/.test(line))
        .map(({ index }) => `${file}:${index + 1}`),
    );
    assert.deepEqual(offenders, []);
  });
});

describe("aksan şüphesi (rapor, otomatik düzeltme yok)", () => {
  it("sözcük sonu è şüpheli, öneri é", () => {
    assert.deepEqual(suspiciousAccent("Alphadjo Cissè"), { words: ["Cissè"], suggestion: "Alphadjo Cissé" });
    assert.deepEqual(suspiciousAccent("A. CISSÈ"), { words: ["CISSÈ"], suggestion: "A. CISSÉ" });
  });

  it("doğru yazımlar listelenmez", () => {
    assert.equal(suspiciousAccent("Alphadjo Cissé"), null);
    assert.equal(suspiciousAccent("Niccolò Barella"), null, "İtalyanca sözcük sonu ò doğru");
    assert.equal(suspiciousAccent("Gaëtan Laborde"), null);
    assert.equal(suspiciousAccent("Hélène Mère"), null, "sözcük içi è Fransızcada doğru");
  });
});
