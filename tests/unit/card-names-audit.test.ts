import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cardTeamName } from "@/lib/archive/names";
import { upperTeamName } from "@/lib/dashboard/name-case";
import { personNeedsReview } from "@/lib/names/person-name";
import { cardVenueName, venueNeedsReview, venueRule } from "@/lib/names/venue-names";
import { computeRecentForm } from "@/lib/services/api-football/form-mappers";
import type { SportmonksPerson } from "@/types/person-name";

/** Kart adı denetimi (2026-10-29): takım adı tek kaynak, stadyum karşılığı, ad raporu süzgeci. */

const person = (displayName: string, nationality: string | null): SportmonksPerson => ({ displayName, firstname: displayName.split(" ")[0]!, lastname: displayName.split(" ").at(-1)!, nationality, jersey: null });

describe("takım kart adı — names.ts tek kaynak", () => {
  it("Haftanın Maçları ve bütün kartlar: AMED SFK, GÖZTEPE SK", () => {
    assert.equal(upperTeamName(cardTeamName("Amed"), { name: "tr", people: "tr" }), "AMED SFK");
    assert.equal(upperTeamName(cardTeamName("Göztepe"), { name: "tr", people: "tr" }), "GÖZTEPE SK");
    assert.equal(cardTeamName("Goztepe"), "Göztepe SK");
  });

  it("Derin Analiz takım adı API adı değil kart adı", () => {
    const form = computeRecentForm([], { id: 549, name: "Besiktas", logoUrl: "" });
    assert.equal(form.teamName, "Beşiktaş");
  });
});

describe("stadyum kart adı", () => {
  it("Türkçe karşılık tablosu", () => {
    assert.deepEqual(cardVenueName("Konya Buyuksehir Belediye Stadium"), { name: "Konya Büyükşehir Stadyumu", source: "table" });
  });

  it("kural: Stadium → Stadyumu (yalnızca ek)", () => {
    assert.equal(venueRule("Corum Sehir Stadium"), "Corum Sehir Stadyumu");
    assert.equal(venueRule("Stadium Galatasaray"), "Galatasaray Stadyumu");
    assert.equal(venueRule("RAMS Park"), null);
  });

  it("admin düzeltmesi tabloyu ve kuralı ezer; Türkçe ad değişmeden kalır", () => {
    const overrides = new Map([["Corum Sehir Stadium", "Çorum Şehir Stadyumu"]]);
    assert.deepEqual(cardVenueName("Corum Sehir Stadium", overrides), { name: "Çorum Şehir Stadyumu", source: "override" });
    assert.equal(cardVenueName("Konya Büyükşehir Stadyumu").name, "Konya Büyükşehir Stadyumu");
  });

  it("raporda: düzeltmesi/karşılığı olmayanlar (kural uygulansa da)", () => {
    assert.equal(venueNeedsReview(cardVenueName("Konya Buyuksehir Belediye Stadium")), false);
    assert.equal(venueNeedsReview(cardVenueName("Corum Sehir Stadium")), true);
    assert.equal(venueNeedsReview(cardVenueName("RAMS Park")), true);
  });
});

describe("ad raporu süzgeci — Türk uyruklu ASCII adlar", () => {
  it("Türk uyruklu ve öneri Türkçe harfli → raporda", () => {
    assert.equal(personNeedsReview("Ugurcan Cakir", person("Uğurcan Çakır", "Turkey"), "Uğurcan Çakır"), true);
  });
  it("öneri aynıysa (Türkçe harf gerekmiyor) ya da yabancı uyrukluysa raporda değil", () => {
    assert.equal(personNeedsReview("Kaan Ayhan", person("Kaan Ayhan", "Turkey"), "Kaan Ayhan"), false);
    assert.equal(personNeedsReview("Victor Osimhen", person("Victor Osimhen", "Nigeria"), "Victor Osimhen"), false);
  });
  it("zaten Türkçe karakterli ad raporda değil; Sportmonks'ta yoksa yabancı harfsiz ASCII ad raporda", () => {
    assert.equal(personNeedsReview("Uğurcan Çakır", null, null), false);
    assert.equal(personNeedsReview("Mert Gunok", null, null), true);
    assert.equal(personNeedsReview("Wilfried Singo", null, null), false);
  });
});
