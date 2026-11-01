import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { HEADLINE_ANNOUNCED, HEADLINE_PREDICTED, lineupHeadline, lineupStatusLine, officialLineupIssue } from "@/lib/dashboard/lineup-draft";
import { heroCandidateOrder, pickLineupHero } from "@/lib/dashboard/lineup-hero-pick";

/**
 * Muhtemel 11 / İlk 11 ve Kahraman Liste kapağı (canlı prova 2026-11-01, Kasımpaşa–Beşiktaş): kartlar son maç
 * kadrosuyla "MUHTEMEL 11" çizildi (resmi kadro ~18:00), Beşiktaş kapağı Orkun Kökçü o 11'de değildi.
 */

const XI = Array.from({ length: 11 }, (_, index) => ({ playerId: 100 + index, name: `Oyuncu ${index + 1}` }));

describe("kart başlığı API durumundan", () => {
  it("iki takım açıkladıysa İLK 11, değilse MUHTEMEL 11", () => {
    assert.equal(HEADLINE_ANNOUNCED, "İLK 11");
    assert.equal(HEADLINE_PREDICTED, "MUHTEMEL 11");
    assert.equal(lineupHeadline({ home: true, away: true }), "İLK 11");
    assert.equal(lineupHeadline({ home: true, away: false }), "MUHTEMEL 11");
    assert.equal(lineupHeadline({ home: false, away: false }), "MUHTEMEL 11");
  });

  it("stüdyo hangisi olduğunu yazar", () => {
    const line = (home: boolean, away: boolean) => lineupStatusLine({ home: { teamName: "Kasımpaşa", announced: home }, away: { teamName: "Beşiktaş", announced: away } });
    assert.match(line(true, true), /Resmi ilk 11'ler açıklandı .* İLK 11, gerçek kadro/u);
    assert.match(line(false, true), /Yalnızca Beşiktaş .* MUHTEMEL 11/u);
    assert.match(line(false, false), /henüz açıklanmadı .* MUHTEMEL 11, son maçın ilk 11'i/u);
  });

  it("resmi 11 açıklandıysa kayıttaki 11 aynı oyuncular olmalı (sıra serbest); açıklanmadıysa denetim yok", () => {
    const team = { teamName: "Beşiktaş", slots: XI.map((slot) => ({ ...slot, number: "" })) };
    const ids = XI.map((slot) => slot.playerId);
    assert.equal(officialLineupIssue(team, [...ids].reverse()), null);
    assert.equal(officialLineupIssue(team, null), null);
    assert.match(officialLineupIssue(team, [...ids.slice(0, 10), 999]) ?? "", /Beşiktaş resmi ilk 11'ini açıkladı .*"Veriden doldur"/u);
  });
});

describe("Kahraman Liste kapağı — 11 kuralı", () => {
  const photos = new Map([[110, "foto-forvet"], [103, "foto-defans"]]);

  it("seçilen kapak oyuncusu 11'deyse o", () => {
    const pick = pickLineupHero({ teamName: "Beşiktaş", slots: XI, selected: { photoId: "secilen", playerApiId: 105, personName: "Oyuncu 6" }, photoByPlayer: photos });
    assert.deepEqual(pick, { kind: "selected", photoId: "secilen", note: null });
  });

  it("11'de değilse 11'de fotoğraflı oyuncu — öndeki önce (forvetten kaleciye), notla", () => {
    assert.deepEqual(heroCandidateOrder(XI).slice(0, 2), [110, 109]);
    const pick = pickLineupHero({ teamName: "Beşiktaş", slots: XI, selected: { photoId: "orkun", playerApiId: 555, personName: "Orkun Kökçü" }, photoByPlayer: photos });
    assert.deepEqual(pick, { kind: "substitute", photoId: "foto-forvet", playerId: 110, note: "Beşiktaş kapağı: Orkun Kökçü bu 11'de değil — 11'den Oyuncu 11 kullanıldı." });
  });

  it("takım fotoğrafı / teknik direktör kapağı da 11 dışı sayılır; seçim yoksa 11'den otomatik", () => {
    assert.equal(pickLineupHero({ teamName: "Beşiktaş", slots: XI, selected: { photoId: "takim", playerApiId: null, personName: null }, photoByPlayer: photos }).photoId, "foto-forvet");
    assert.equal(pickLineupHero({ teamName: "Beşiktaş", slots: XI, selected: null, photoByPlayer: photos }).kind, "substitute");
  });

  it("11'de fotoğraflı oyuncu yoksa yedek tasarım (kart Kahraman Liste kalır)", () => {
    const pick = pickLineupHero({ teamName: "Kasımpaşa", slots: XI, selected: null, photoByPlayer: new Map() });
    assert.deepEqual(pick, { kind: "fallback", photoId: null, note: "Kasımpaşa kapağı: 11'de takım formalı fotoğrafı olan oyuncu yok — yedek tasarım." });
    const off = pickLineupHero({ teamName: "Beşiktaş", slots: XI, selected: { photoId: "orkun", playerApiId: 555, personName: "Orkun Kökçü" }, photoByPlayer: new Map() });
    assert.equal(off.kind, "fallback");
    assert.match(off.note ?? "", /Orkun Kökçü bu 11'de değil, 11'de takım formalı fotoğrafı olan oyuncu yok/u);
  });
});
