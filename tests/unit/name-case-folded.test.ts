import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isFoldedMixedI, upperName } from "@/lib/dashboard/name-case";
import { shortForm } from "@/lib/names/person-name";

/**
 * I/İ (2026-10-30, Konyaspor–Galatasaray Maç Analizi): Sportmonks eşleşmesi olmayan API adı "M. Ibrahimoglu"
 * Türk takımı ipucuyla Türkçe büyüyünce "M. IBRAHİMOGLU" (karışık I ve İ) çıkıyordu. Kural: ASCII'ye
 * katlanmış, hem "I" hem "i" taşıyan sözcük TUTARLI uluslararası büyür ("IBRAHIMOGLU"). Türkçe işaretli
 * adlar (Sportmonks/arşivden geri yüklenmiş) eskisi gibi Türkçe büyür.
 */

describe("ad büyük harfi — ASCII'ye katlanmış Türk adı", () => {
  it("M. Ibrahimoglu (Türk takımı ipucu) → M. IBRAHIMOGLU, karışık I/İ yok", () => {
    const upper = upperName(shortForm("M. Ibrahimoglu"), "tr");
    assert.equal(upper, "M. IBRAHIMOGLU");
    assert.doesNotMatch(upper, /İ/u);
    assert.equal(upperName("Ismail Yuksek", "tr"), "ISMAIL YUKSEK");
  });

  it("katlanma sezgisi yalnızca karışık sonuç verecek ASCII sözcükte", () => {
    assert.equal(isFoldedMixedI("Ibrahimoglu"), true);
    assert.equal(isFoldedMixedI("İbrahimoğlu"), false);
    assert.equal(isFoldedMixedI("Demiral"), false);
    assert.equal(isFoldedMixedI("Ilkay"), false);
  });

  it("mevcut kurallar değişmez", () => {
    assert.equal(upperName("Uğurcan Çakır", "tr"), "UĞURCAN ÇAKIR");
    assert.equal(upperName("İlkay Gündoğan", "tr"), "İLKAY GÜNDOĞAN");
    assert.equal(upperName("İbrahimoğlu", "tr"), "İBRAHİMOĞLU");
    assert.equal(upperName("Mbangula", "tr"), "MBANGULA");
    assert.equal(upperName("Mbangula", "intl"), "MBANGULA");
    assert.equal(upperName("Vinícius Júnior", "tr"), "VINÍCIUS JÚNIOR");
    assert.equal(upperName("Oh Hyeon-Gyu", "intl"), "OH HYEON-GYU");
    assert.equal(upperName("Demiral", "tr"), "DEMİRAL");
    assert.equal(upperName("Borussia Dortmund", "intl"), "BORUSSIA DORTMUND");
  });
});
