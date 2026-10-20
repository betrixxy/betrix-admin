import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { foldTr, matchesQuery } from "@/lib/text-fold";
import { MATCH_IMPORTANCE_OPTIONS } from "@/types/sports";

describe("Türkçe karakter duyarsız arama", () => {
  it("katlama: Türkçe harfler ve aksanlar", () => {
    assert.equal(foldTr("Orkun Kökçü"), "orkun kokcu");
    assert.equal(foldTr("İSTANBUL Başakşehir"), "istanbul basaksehir");
    assert.equal(foldTr("Işık Ağaoğlu"), "isik agaoglu");
    assert.equal(foldTr("Vinícius  Júnior"), "vinicius junior");
  });

  it("eşleşme: 'kokcu' → Orkun Kökçü; sözcük sırası serbest; boş sorgu her şeyi geçirir", () => {
    assert.ok(matchesQuery("Orkun Kökçü", "kokcu"));
    assert.ok(matchesQuery("Orkun Kökçü", "KÖKÇÜ orkun"));
    assert.ok(matchesQuery("Uğurcan Çakır", "ugurcan cak"));
    assert.ok(!matchesQuery("Orkun Kökçü", "arda"));
    assert.ok(matchesQuery("Orkun Kökçü", "  "));
  });
});

describe("Maç önemi — tek kaynak", () => {
  it("etiketler ve değerler (atmosfer prompt'ları değişmedi)", () => {
    assert.deepEqual(
      MATCH_IMPORTANCE_OPTIONS.map((option) => [option.label, option.value]),
      [["Normal", "NONE"], ["Derbi", "DERBY"], ["Büyük derbi", "ELITE_DERBY"], ["Final-kritik", "RIVALRY"]],
    );
  });
});
