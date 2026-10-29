import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { venueBoxes } from "@/skills/render-engine/templates/match-day/data-driven";
import { MATCH_DAY_SCENARIOS } from "../fixtures/match-day/cards";

/** Maç Günü Data Driven: stadyum tarih bloğunda yazar — alttaki kutu yalnızca başka bir bilgi (hakem) varsa. */
describe("Maç Günü Data Driven künye kutusu", () => {
  const base = { ...MATCH_DAY_SCENARIOS.nostats_nologos!, stats: null };

  test("stadyum kutuda tekrar edilmez; hakem tek kutu", () => {
    assert.deepEqual(venueBoxes(base), [{ label: "HAKEM", value: "Ali Şansalan" }]);
  });

  test("hakem yoksa kutu yok (yalnızca stadyum → tarih bloğunda)", () => {
    assert.deepEqual(venueBoxes({ ...base, stadiumLabel: "Konya Büyükşehir Stadyumu", refereeLabel: "—" }), []);
  });

  test("uzun hakem adı tam genişlikte kesilmez", () => {
    assert.deepEqual(venueBoxes({ ...base, refereeLabel: "Abdulkadir Bitigen Yılmazer" }), [{ label: "HAKEM", value: "Abdulkadir Bitigen Yılmazer" }]);
  });
});
