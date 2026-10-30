import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { namedScorerLines } from "@/lib/names/scorer-names";
import type { TeamPeople } from "@/lib/names/person-name";
import type { ResultTeam } from "@/types/match-result";
import type { SportmonksPerson } from "@/types/person-name";

/**
 * Set golcü adları (2026-10-30): kendi kalesine golün satırı golün yazıldığı tarafta, golü atan rakipten —
 * ad önce rakibin kadrosunda aranır (API ASCII verse de Türkçe harf geri yüklenir); arşiv düzeltmesi oyuncu
 * kimliğiyle iki takımda da geçerli. Normal gol yalnızca kendi kadrosunda.
 */

const person = (displayName: string, firstname: string, lastname: string): SportmonksPerson => ({ displayName, firstname, lastname, nationality: "Turkey", jersey: null });
const team = (name: string, scorers: ResultTeam["scorers"]): ResultTeam => ({ id: 1, name, logoUrl: "", goals: scorers.length, scorers, colorHex: "" });
const people = (list: SportmonksPerson[], overrides: ReadonlyMap<number, string> = new Map()): TeamPeople => ({ people: list, overrides, teamHint: "tr" });

const GENCLERBIRLIGI = people([person("İrfan Can Eğribayat", "İrfan Can", "Eğribayat")]);
const GALATASARAY = people([person("Barış Alper Yılmaz", "Barış Alper", "Yılmaz")]);

describe("set golcü adları — kendi kalesine gol", () => {
  it("ASCII gelen KK golcüsü rakibin kadrosundan Türkçe harfle geri yüklenir", () => {
    const gs = team("Galatasaray", [{ playerId: 62137, name: "I. Egribayat", minutes: ["88' (KK)"] }]);
    assert.equal(namedScorerLines(gs, GALATASARAY, GENCLERBIRLIGI).scorers[0]?.name, "İ. Eğribayat");
  });

  it("normal gol rakip kadroda aranmaz; KK düzeltmesi oyuncu kimliğiyle", () => {
    const gs = team("Galatasaray", [{ playerId: 99, name: "I. Egribayat", minutes: ["12'"] }]);
    assert.equal(namedScorerLines(gs, GALATASARAY, GENCLERBIRLIGI).scorers[0]?.name, "I. Egribayat");
    const fixed = people([], new Map([[62137, "İrfan Can Eğribayat"]]));
    const kk = team("Galatasaray", [{ playerId: 62137, name: "I. Egribayat", minutes: ["88' (KK)"] }]);
    assert.equal(namedScorerLines(kk, GALATASARAY, fixed).scorers[0]?.name, "İ. Eğribayat");
  });

  it("KK golcüsü hiçbir kadroda yoksa API kısa adı", () => {
    const gs = team("Galatasaray", [{ playerId: 5, name: "X. Nobody", minutes: ["3' (KK)"] }]);
    assert.equal(namedScorerLines(gs, GALATASARAY, GENCLERBIRLIGI).scorers[0]?.name, "X. Nobody");
  });
});
