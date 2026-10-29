import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { upperName } from "@/lib/dashboard/name-case";
import { cardPersonName, foldName, isAsciiName, matchPerson, restoreName } from "@/lib/names/person-name";
import type { SportmonksPerson } from "@/types/person-name";

/**
 * Kart kişi adı (denetim 2026-10-29, Konyaspor–Galatasaray): API-Football Türk adlarını ASCII verir,
 * Muhtemel 11 yabancı adları Türkçe büyütüyordu (OSİMHEN). Öncelik: arşiv düzeltmesi → Sportmonks → API;
 * büyük harf kökeni adın harfi → uyruk → takım.
 */

const p = (displayName: string, nationality: string | null, jersey: number | null = null, firstname?: string, lastname?: string): SportmonksPerson => {
  const parts = displayName.split(" ");
  return { displayName, firstname: firstname ?? parts.slice(0, -1).join(" "), lastname: lastname ?? parts.at(-1)!, nationality, jersey };
};

const GALATASARAY = [
  p("Uğurcan Çakır", "Turkey", 1),
  p("Yunus Akgün", "Turkey", 11),
  p("Barış Alper Yılmaz", "Turkey", 53, "Barış Alper", "Yılmaz"),
  p("Arda Yılmaz", "Turkey", 60),
  p("Jankat Yılmaz", "Turkey", 24),
  p("Abdülkerim Bardakcı", "Turkey", 42),
  p("Victor Osimhen", "Nigeria", 45, "Victor James", "Osimhen"),
  p("Lucas Torreira", "Uruguay", 34, "Lucas", "Torreira Di Pascua"),
  p("Roland Sallai", "Hungary", 7),
  p("Mario Lemina", "Gabon", 99),
  p("Davinson Sánchez", "Colombia", 6, "Davinson", "Sánchez Mina"),
  p("İlkay Gündoğan", "Germany", 20),
  p("Ismail Jakobs", "Senegal", 4),
];
const KONYASPOR = [
  p("Bahadır Güngördü", "Turkey", 1),
  p("Deniz Türüç", "Turkey", 10),
  p("Melih İbrahimoğlu", "Turkey", 6),
  p("Marko Jevtović", "Serbia", 8),
  p("Chidozie Awaziem", "Nigeria", 5),
];

const card = (apiName: string, people: SportmonksPerson[], jersey: number | null = null) => {
  // Takım ipucu Türk (Galatasaray/Konyaspor): uyruk bulunmasa eski davranış Türkçe büyütmekti.
  const resolved = cardPersonName({ apiName, people, jersey, teamHint: "tr" });
  return upperName(resolved.name, resolved.origin);
};

describe("kart kişi adı — Türkçe karakter geri yükleme", () => {
  it("kullanıcının beklediği adlar", () => {
    assert.equal(card("U. Cakir", GALATASARAY), "U. ÇAKIR");
    assert.equal(card("Y. Akgun", GALATASARAY), "Y. AKGÜN");
    assert.equal(card("B. Yilmaz", GALATASARAY), "B. YILMAZ");
    assert.equal(card("A. Bardakci", GALATASARAY), "A. BARDAKCI");
    assert.equal(card("B. Gungordu", KONYASPOR), "B. GÜNGÖRDÜ");
    assert.equal(card("D. Turuc", KONYASPOR), "D. TÜRÜÇ");
    assert.equal(card("M. Ibrahimoglu", KONYASPOR), "M. İBRAHİMOĞLU");
  });

  it("yabancı oyuncular Türk takımında da uluslararası büyük harf", () => {
    assert.equal(card("V. Osimhen", GALATASARAY), "V. OSIMHEN");
    assert.equal(card("L. Torreira", GALATASARAY), "L. TORREIRA");
    assert.equal(card("R. Sallai", GALATASARAY), "R. SALLAI");
    assert.equal(card("M. Lemina", GALATASARAY), "M. LEMINA");
    assert.equal(card("M. Jevtovic", KONYASPOR), "M. JEVTOVIĆ");
    assert.equal(card("C. Awaziem", KONYASPOR), "C. AWAZIEM");
    assert.equal(card("Ismail Jakobs", GALATASARAY), "ISMAIL JAKOBS");
    // API biçimi korunur, aksan geri gelir; Türk adlı yabancı uyruklu oyuncu Türkçe harfle.
    assert.equal(card("D. Sanchez", GALATASARAY), "D. SÁNCHEZ");
    assert.equal(card("I. Gundogan", GALATASARAY), "İ. GÜNDOĞAN");
  });

  it("teknik direktör aynı kuraldan geçer", () => {
    const coach = cardPersonName({ apiName: "Ilhan Palut", people: [p("İlhan Palut", "Turkey")] });
    assert.deepEqual(coach, { name: "İlhan Palut", origin: "tr", source: "sportmonks" });
  });

  it("öncelik: arşiv düzeltmesi → Sportmonks → API", () => {
    assert.equal(cardPersonName({ apiName: "U. Cakir", override: "Uğurcan Çakır", people: GALATASARAY }).source, "override");
    assert.equal(cardPersonName({ apiName: "U. Cakir", override: "  ", people: GALATASARAY }).name, "U. Çakır");
    assert.deepEqual(cardPersonName({ apiName: "K. Demir", people: GALATASARAY, teamHint: "tr" }), { name: "K. Demir", origin: "tr", source: "api" });
  });
});

describe("eşleştirme — tahmin yok", () => {
  it("aynı soyadı: baş harf ayırır, o da tutmazsa forma numarası, yine belirsizse eşleşme yok", () => {
    assert.equal(matchPerson("A. Yilmaz", GALATASARAY)?.displayName, "Arda Yılmaz");
    const twins = [p("Arda Yılmaz", "Turkey", 60), p("Ahmet Yılmaz", "Turkey", 18)];
    assert.equal(matchPerson("A. Yilmaz", twins), null);
    assert.equal(matchPerson("A. Yilmaz", twins, 18)?.displayName, "Ahmet Yılmaz");
  });

  it("soyadı tutmayan aday seçilmez; bitişik baş harf ayrılır", () => {
    assert.equal(matchPerson("L. Sane", GALATASARAY), null);
    assert.equal(restoreName("A.Yuzgec", p("Ada Yüzgeç", "Turkey")), "A. Yüzgeç");
  });

  it("katlama ve ASCII süzgeci", () => {
    assert.equal(foldName("İbrahimoğlu"), foldName("Ibrahimoglu"));
    assert.equal(foldName("Sánchez"), "sanchez");
    assert.ok(isAsciiName("U. Cakir") && !isAsciiName("U. Çakır"));
  });
});
