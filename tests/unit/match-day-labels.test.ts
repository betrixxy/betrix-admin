import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { upperName } from "@/lib/dashboard/name-case";
import { formatWeek } from "@/lib/dashboard/match-day-assets";
import { matchDayRoundLabel } from "@/lib/dashboard/match-result-labels";
import { cardRefereeName, splitReferee } from "@/lib/names/person-name";
import type { SportmonksPerson } from "@/types/person-name";

/**
 * Maç Günü künyesi (denetim 2026-10-30): tur adları Türkçe ("Quarter-finals" → "ÇEYREK FİNAL", İngilizce
 * ham dize "QUARTER-FİNALS" yazılmıyordu), UEFA lig aşaması "3. MAÇ" ("3. HAFTA" değil); hakem adı kişi
 * adı kuralından (Sportmonks hakem kaydı harfleri geri yükler, ülke eki atılır).
 */

describe("Maç Günü tur etiketi", () => {
  it("lig haftası, Avrupa lig aşaması ve maç günleri", () => {
    assert.equal(matchDayRoundLabel("Regular Season - 3"), "3. Hafta");
    assert.equal(matchDayRoundLabel("League Stage - 3"), "3. Maç");
    assert.equal(matchDayRoundLabel("Group A - 2"), "2. Maç");
    assert.equal(matchDayRoundLabel("League A - 4"), "4. Maç");
    assert.equal(matchDayRoundLabel(null), "");
  });

  it("eleme turları ortak Türkçe tablodan", () => {
    assert.equal(matchDayRoundLabel("Quarter-finals"), "Çeyrek Final");
    assert.equal(matchDayRoundLabel("Round of 16"), "Son 16 Turu");
    assert.equal(matchDayRoundLabel("Knockout Round Play-offs"), "Play-off Turu");
    assert.equal(matchDayRoundLabel("Final"), "Final");
  });

  it("kart büyük harfi: Türkçe etiket Türkçe, tanınmayan İngilizce tur köken kuralıyla", () => {
    assert.equal(formatWeek("3"), "3. HAFTA");
    assert.equal(formatWeek(matchDayRoundLabel("League Stage - 3")), "3. MAÇ");
    assert.equal(formatWeek(matchDayRoundLabel("Quarter-finals")), "ÇEYREK FİNAL");
    assert.equal(formatWeek("Round of 64"), "ROUND OF 64");
    assert.equal(formatWeek("Quarter-finals"), "QUARTER-FINALS");
    assert.equal(formatWeek(""), null);
  });
});

describe("Maç Günü hakem adı", () => {
  const coskunses: SportmonksPerson = { displayName: "Reşat Onur Coşkunses", firstname: "Reşat Onur", lastname: "Coşkunses", nationality: "Turkey", jersey: null };

  it("ülke eki ayrılır", () => {
    assert.deepEqual(splitReferee("Resat Onur Coskunses, Türkiye"), { name: "Resat Onur Coskunses", country: "Türkiye" });
    assert.deepEqual(splitReferee("Lawrence Visser"), { name: "Lawrence Visser", country: null });
  });

  it("Sportmonks hakem kaydı Türkçe harfleri geri yükler; büyük harf Türkçe", () => {
    const card = cardRefereeName("Resat Onur Coskunses, Türkiye", [coskunses]);
    assert.equal(card.name, "Reşat Onur Coşkunses");
    assert.equal(upperName(card.name, card.origin), "REŞAT ONUR COŞKUNSES");
  });

  it("kayıt yoksa API'nin yaygın adı (soyada indirilmez); ülke ekinden köken", () => {
    const tr = cardRefereeName("Resat Onur Coskunses, Türkiye", []);
    assert.deepEqual([tr.name, tr.origin], ["Resat Onur Coskunses", "tr"]);
    const es = cardRefereeName("Ricardo De Burgos Bengoetxea, Spain", []);
    assert.deepEqual([es.name, es.origin], ["Ricardo De Burgos Bengoetxea", "intl"]);
    assert.equal(upperName(es.name, es.origin), "RICARDO DE BURGOS BENGOETXEA");
  });
});
