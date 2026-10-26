import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { nameOrigin, originFromCountry, teamNameOrigin, upperName, upperTeamName, wordOrigin } from "@/lib/dashboard/name-case";

/**
 * Ad büyük harfi (kurucu kararı, 2026-10-20): Türkçe büyük harf yalnızca Türk adlarına.
 */

describe("upperName — Türkçe büyük harf yalnızca Türk adlarına", () => {
  it("kurucu örnekleri", () => {
    assert.equal(upperName("Vlahović"), "VLAHOVIĆ");
    assert.equal(upperName("Borussia", "intl"), "BORUSSIA");
    assert.equal(upperName("İrfan Can Eğribayat"), "İRFAN CAN EĞRİBAYAT");
  });

  it("yabancı harf (ć, é, ß, w, x, q) adı uluslararası yapar — ipucu Türkçe olsa bile", () => {
    assert.equal(upperName("Dušan Vlahović", "tr"), "DUŠAN VLAHOVIĆ");
    assert.equal(upperName("Clément Turpin", "tr"), "CLÉMENT TURPIN");
    assert.equal(upperName("Wolverhampton Wanderers", "tr"), "WOLVERHAMPTON WANDERERS");
  });

  it("Türkçeye özgü harf (ı, ğ, ş, İ) ya da '-spor' eki adı Türkçe yapar — ipucu yabancı olsa bile", () => {
    assert.equal(upperName("Kenan Yıldız", "intl"), "KENAN YILDIZ");
    assert.equal(upperName("Kayserispor", "intl"), "KAYSERİSPOR");
    assert.equal(upperName("Cengiz Ünder Kayserispor", "intl"), "CENGİZ ÜNDER KAYSERİSPOR");
    assert.equal(upperName("Sporting", "tr"), "SPORTİNG", "'Sporting' Türk kulüp eki değil — ipucuna uyar");
  });

  it("belirsiz ad (ASCII + ö ü ç) ipucuna uyar; ipucu yoksa önceki davranış (Türkçe)", () => {
    assert.equal(upperName("Borussia Mönchengladbach", "intl"), "BORUSSIA MÖNCHENGLADBACH");
    assert.equal(upperName("Tim Kleindienst", "intl"), "TIM KLEINDIENST");
    assert.equal(upperName("Gaziantep FK", "tr"), "GAZİANTEP FK");
    assert.equal(upperName("Gaziantep FK"), "GAZİANTEP FK");
  });

  it("sözcük sözcük: belirsiz sözcük adın işaretine uyar, boşluklar korunur", () => {
    assert.equal(upperName("Tim Kleindienst"), "TİM KLEİNDİENST", "ipucu yoksa önceki davranış");
    assert.equal(upperName("Tim Kleindienst", "intl"), "TIM KLEINDIENST");
    assert.equal(upperName("Kevin  Stöger", "intl"), "KEVIN  STÖGER");
    assert.equal(nameOrigin("Can Eğribayat"), "tr");
    assert.equal(wordOrigin("Can"), null);
  });

  it("ülkeden köken; takım adında Türkçe karşılık (Bayern Münih) Türkçe kalır", () => {
    assert.equal(originFromCountry("Turkey"), "tr");
    assert.equal(originFromCountry("Germany"), "intl");
    assert.equal(originFromCountry(null), null);
    const germany = { name: "intl" as const, people: "intl" as const };
    assert.equal(teamNameOrigin("Bayern Münih", germany), "tr");
    assert.equal(upperTeamName("Bayern Münih", germany), "BAYERN MÜNİH");
    assert.equal(upperTeamName("Leverkusen", germany), "LEVERKUSEN");
    assert.equal(upperTeamName("Midtjylland", { name: "intl", people: "intl" }), "MIDTJYLLAND");
  });
});
