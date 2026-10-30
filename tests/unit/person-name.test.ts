import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { upperName } from "@/lib/dashboard/name-case";
import { cardPersonName, foldName, isAsciiName, matchPerson, posterName, restoreName, shortNameOf, surnameOf } from "@/lib/names/person-name";
import type { SportmonksPerson } from "@/types/person-name";

/**
 * Kart kişi adı (denetim 2026-10-29, Konyaspor–Galatasaray): API-Football Türk adlarını ASCII verir,
 * Muhtemel 11 yabancı adları Türkçe büyütüyordu (OSİMHEN). Kural 2026-10-30: resmi tam ad (firstname +
 * lastname) kartta yok — arşiv düzeltmesi → Sportmonks yaygın adı → API kısa adından soyad; büyük harf
 * kökeni adın harfi → uyruk → takım.
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
  // Sportmonks gerçek kaydı: iki "M. Ibrahimoglu", soyadı alanı ASCII, uyruk Avusturya.
  p("Melih İbrahimoğlu", "Austria", 77, "Melih", "Ibrahimoglu"),
  p("Mücahit İbrahimoğlu", "Austria", 24, "Mücahit", "Ibrahimoglu"),
  p("Marko Jevtović", "Serbia", 8),
  p("Chidozie Awaziem", "Nigeria", 5),
];

const card = (apiName: string, people: SportmonksPerson[], jersey: number | null = null) => {
  // Takım ipucu Türk (Galatasaray/Konyaspor): uyruk bulunmasa eski davranış Türkçe büyütmekti.
  const resolved = cardPersonName({ apiName, people, jersey, teamHint: "tr" });
  return upperName(resolved.name, resolved.origin);
};

describe("kart kişi adı — resmi tam ad yok (2026-10-30)", () => {
  it("Sportmonks yaygın adı (Türkçe harfli), resmi ilk ad değil", () => {
    assert.equal(card("U. Cakir", GALATASARAY), "UĞURCAN ÇAKIR");
    assert.equal(card("Y. Akgun", GALATASARAY), "YUNUS AKGÜN");
    assert.equal(card("B. Yilmaz", GALATASARAY), "BARIŞ ALPER YILMAZ");
    assert.equal(card("A. Bardakci", GALATASARAY), "ABDÜLKERİM BARDAKCI");
    assert.equal(card("B. Gungordu", KONYASPOR), "BAHADIR GÜNGÖRDÜ");
    assert.equal(card("D. Turuc", KONYASPOR), "DENİZ TÜRÜÇ");
    assert.equal(card("M. Ibrahimoglu", KONYASPOR, 77), "MELİH İBRAHİMOĞLU");
    // Forma numarası yoksa iki aday belirsiz → tahmin yok, API soyadı (raporda listelenir).
    assert.deepEqual(cardPersonName({ apiName: "M. Ibrahimoglu", people: KONYASPOR }), { name: "Ibrahimoglu", short: "M. Ibrahimoglu", origin: null, source: "api", reliable: false });
  });

  it("yabancı oyuncular Türk takımında da uluslararası büyük harf; resmi ad alanı (Victor James, Torreira Di Pascua) yazılmaz", () => {
    assert.equal(card("V. Osimhen", GALATASARAY), "VICTOR OSIMHEN");
    assert.equal(card("L. Torreira", GALATASARAY), "LUCAS TORREIRA");
    assert.equal(card("M. Jevtovic", KONYASPOR), "MARKO JEVTOVIĆ");
    assert.equal(card("Ismail Jakobs", GALATASARAY), "ISMAIL JAKOBS");
    assert.equal(card("D. Sanchez", GALATASARAY), "DAVINSON SÁNCHEZ");
    assert.equal(card("I. Gundogan", GALATASARAY), "İLKAY GÜNDOĞAN");
  });

  it("Mbangula: eşleşme yoksa API kısa adından soyad; yaygın adsız kayıt resmi adı getirmez", () => {
    assert.deepEqual(cardPersonName({ apiName: "S. Mbangula", people: [] }), { name: "Mbangula", short: "S. Mbangula", origin: null, source: "api", reliable: false });
    const official = { displayName: null, firstname: "Samuel-Germain", lastname: "Mbangula Tshifunda", nationality: "Belgium", jersey: 7 };
    assert.equal(cardPersonName({ apiName: "S. Mbangula", people: [official] }).name, "Mbangula");
    // Baş harfli yaygın ad ("S. Mbangula" common_name) güvenilir sayılmaz → soyad.
    assert.equal(cardPersonName({ apiName: "S. Mbangula", people: [{ ...official, displayName: "S. Mbangula" }] }).name, "Mbangula");
    assert.deepEqual(cardPersonName({ apiName: "S. Mbangula", people: [{ ...official, displayName: "Samuel Mbangula" }] }), { name: "Samuel Mbangula", short: "S. Mbangula", origin: "intl", source: "sportmonks", reliable: true });
  });

  it("Vinícius Júnior: yaygın ad; resmi 'Vinícius José Paixão de Oliveira Júnior' değil", () => {
    const vini = { displayName: "Vinícius Júnior", firstname: "Vinícius José", lastname: "Paixão de Oliveira Júnior", nationality: "Brazil", jersey: 7 };
    assert.equal(cardPersonName({ apiName: "Vinícius Júnior", people: [vini] }).name, "Vinícius Júnior");
    assert.equal(cardPersonName({ apiName: "Vinícius Júnior", people: [] }).name, "Vinícius Júnior");
    assert.equal(shortNameOf("VINÍCIUS JÚNIOR"), "VINÍCIUS JÚNIOR");
    assert.equal(surnameOf("D. Van der Westhuizen"), "Van der Westhuizen");
    assert.equal(surnameOf("A. Hernández de la Fuente"), "de la Fuente");
  });

  it("tek adlı oyuncu (Gabriel): yaygın ad tek sözcük, soyad aynı", () => {
    const gabriel = { displayName: "Gabriel", firstname: "Gabriel dos Santos", lastname: "Magalhães", nationality: "Brazil", jersey: 6 };
    assert.equal(cardPersonName({ apiName: "Gabriel", people: [gabriel] }).name, "Gabriel");
    assert.equal(cardPersonName({ apiName: "Gabriel", people: [] }).name, "Gabriel");
    assert.equal(surnameOf("Gabriel"), "Gabriel");
  });

  it("Türk oyuncu, Sportmonks yok: ASCII soyad, Türkçe büyük harf takım ipucundan", () => {
    assert.equal(card("K. Akturkoglu", []), "AKTURKOGLU");
    assert.equal(card("A.Yüzgeç", []), "YÜZGEÇ");
  });

  it("teknik direktör aynı kuraldan geçer", () => {
    const coach = cardPersonName({ apiName: "Ilhan Palut", people: [p("İlhan Palut", "Turkey")] });
    assert.deepEqual(coach, { name: "İlhan Palut", short: "İ. Palut", origin: "tr", source: "sportmonks", reliable: true });
  });

  it("öncelik: arşiv düzeltmesi → Sportmonks yaygın adı → API soyadı", () => {
    assert.deepEqual(cardPersonName({ apiName: "U. Cakir", override: "Uğurcan Çakır", people: GALATASARAY }).source, "override");
    assert.equal(cardPersonName({ apiName: "U. Cakir", override: "  ", people: GALATASARAY }).name, "Uğurcan Çakır");
    assert.equal(cardPersonName({ apiName: "S. Mbangula", override: "S. Mbangula" }).reliable, false);
    assert.deepEqual(cardPersonName({ apiName: "K. Demir", people: GALATASARAY, teamHint: "tr" }), { name: "Demir", short: "K. Demir", origin: "tr", source: "api", reliable: false });
  });
});

describe("kısa ad — baş harf + soyad, Türkçe harfler korunur", () => {
  const short = (apiName: string, people: SportmonksPerson[], jersey: number | null = null, teamHint: "tr" | "intl" = "tr") => {
    const resolved = cardPersonName({ apiName, people, jersey, teamHint });
    return upperName(resolved.short, resolved.origin);
  };

  it("Sportmonks yaygın adından", () => {
    assert.equal(short("U. Cakir", GALATASARAY), "U. ÇAKIR");
    assert.equal(short("B. Yilmaz", GALATASARAY), "B. YILMAZ");
    assert.equal(short("M. Ibrahimoglu", KONYASPOR, 77), "M. İBRAHİMOĞLU");
    assert.equal(short("V. Osimhen", GALATASARAY), "V. OSIMHEN");
    assert.equal(short("I. Gundogan", GALATASARAY), "İ. GÜNDOĞAN");
    assert.equal(short("D. Sanchez", GALATASARAY), "D. SÁNCHEZ");
  });

  it("eşleşme yoksa API baş harfi + soyad; ad bilinmiyorsa yalnız soyad", () => {
    // Yabancı takım (uluslararası büyük harf).
    assert.equal(short("S. Mbangula", [], null, "intl"), "S. MBANGULA");
    assert.equal(short("A. Hernández de la Fuente", [], null, "intl"), "A. DE LA FUENTE");
    assert.equal(short("D. Van der Westhuizen", [], null, "intl"), "D. VAN DER WESTHUIZEN");
    assert.equal(short("Ismail Jakobs", [], null, "intl"), "I. JAKOBS");
    assert.equal(short("Mbangula", [], null, "intl"), "MBANGULA");
    assert.equal(short("Gabriel", [], null, "intl"), "GABRIEL");
    assert.equal(short("Vinícius Júnior", [], null, "intl"), "VINÍCIUS JÚNIOR");
    // Türk takımı, Sportmonks yok: API baş harfi + ASCII soyad.
    assert.equal(short("K. Akturkoglu", []), "K. AKTURKOGLU");
  });

  it("yaygın adı tek sözcük ya da soneki olan oyuncu", () => {
    const vini = { displayName: "Vinícius Júnior", firstname: "Vinícius José", lastname: "Paixão de Oliveira Júnior", nationality: "Brazil", jersey: 7 };
    assert.equal(cardPersonName({ apiName: "Vinícius Júnior", people: [vini] }).short, "Vinícius Júnior");
    const gabriel = { displayName: "Gabriel", firstname: "Gabriel dos Santos", lastname: "Magalhães", nationality: "Brazil", jersey: 6 };
    assert.equal(cardPersonName({ apiName: "Gabriel", people: [gabriel] }).short, "Gabriel");
  });

  it("admin düzeltmesi kısa biçime de geçer", () => {
    assert.equal(cardPersonName({ apiName: "U. Cakir", override: "Uğurcan Çakır" }).short, "U. Çakır");
  });
});

describe("poster adı — ilk ad yalnızca güvenilir yaygın adda", () => {
  it("güvenilir: ilk ad küçük + soyad büyük", () => {
    assert.deepEqual(posterName("Samuel Mbangula", true), { firstName: "Samuel", lastName: "Mbangula" });
    assert.deepEqual(posterName("İRFAN CAN EĞRİBAYAT", true), { firstName: "İRFAN CAN", lastName: "EĞRİBAYAT" });
    assert.deepEqual(posterName("VIRGIL VAN DIJK", true), { firstName: "VIRGIL", lastName: "VAN DIJK" });
    assert.deepEqual(posterName("Vinícius Júnior", true), { firstName: "", lastName: "Vinícius Júnior" });
    assert.deepEqual(posterName("Gabriel", true), { firstName: "", lastName: "Gabriel" });
  });

  it("güvenilir değil: yalnızca soyad", () => {
    assert.deepEqual(posterName("Mbangula", false), { firstName: "", lastName: "Mbangula" });
    assert.deepEqual(posterName("S. MBANGULA", false), { firstName: "", lastName: "MBANGULA" });
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
    // NFD'de ayrışmayan harfler (görsel test fixture'ı yakaladı: "Jørgensen" eşleşmiyordu).
    assert.equal(foldName("Jørgensen"), "jorgensen");
    assert.equal(foldName("Łukasz Weißmann"), "lukasz weissmann");
  });

  it("tireli soyad parça parça eşleşir ve harfleri geri yüklenir", () => {
    const person = p("Mohamed-Ali Kouyaté-Diakhaby", "Mali", null, "Mohamed-Ali", "Kouyaté-Diakhaby");
    assert.equal(matchPerson("M. Kouyate-Diakhaby", [person])?.displayName, "Mohamed-Ali Kouyaté-Diakhaby");
    assert.equal(restoreName("M. Kouyate-Diakhaby", { ...person, displayName: null }), "M. Kouyaté-Diakhaby");
    assert.equal(matchPerson("L. Jorgensen", [p("Lars Jørgensen", "Denmark")])?.displayName, "Lars Jørgensen");
  });
});
