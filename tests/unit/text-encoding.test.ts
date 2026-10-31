import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { repairMojibake, repairMojibakeDeep } from "@/lib/names/text-encoding";
import { cardPersonName } from "@/lib/names/person-name";
import { tidyText } from "@/skills/render-engine/satori-text";

/** Canlı test v3 (2026-10-31): API-Football "Relja Obrić" adını "Relja ObriÄ\u0087" diye verdi. */
const BROKEN = "R. ObriÄ\u0087";

describe("bozuk kodlama onarımı", () => {
  test("çift kodlanmış UTF-8 geri çözülür", () => {
    assert.equal(repairMojibake(BROKEN), "R. Obrić");
    assert.equal(repairMojibake("Relja ObriÄ\u0087"), "Relja Obrić");
    assert.equal(repairMojibake("JosÃ©"), "José");
    assert.equal(repairMojibake("MÃ¼ller"), "Müller");
  });

  test("doğru metne dokunulmaz", () => {
    for (const ok of ["Uğurcan Çakır", "Kacper Kozłowski", "Pléa", "Müller", "Atlético Madrid", "Göztepe SK", "2026/27  ·  SÜPER LİG", "Ã"]) {
      assert.equal(repairMojibake(ok), ok);
    }
  });

  test("çözülemeyen kontrol karakteri atılır", () => {
    assert.equal(repairMojibake("A\u0087B"), "AB");
    assert.equal(repairMojibake("Çakır\u0087"), "Çakır");
  });

  test("API yanıt ağacı onarılır, yapı korunur", () => {
    assert.deepEqual(repairMojibakeDeep({ player: { id: 400530, name: BROKEN, tags: [BROKEN, 7, null] } }), { player: { id: 400530, name: "R. Obrić", tags: ["R. Obrić", 7, null] } });
  });

  test("kart adı onarılır; render sınırında kontrol karakteri kalmaz", () => {
    const name = cardPersonName({ apiName: BROKEN });
    assert.equal(name.name, "Obrić");
    assert.equal(name.short, "R. Obrić");
    // Büyütülmüş bozuk ad render sınırına gelirse de font dışı karakter çizilmez.
    const upper = `R. OBRI${String.fromCharCode(0xc4, 0x87)}`;
    assert.ok(!/[\u0080-\u009f]/u.test(tidyText(upper)));
  });
});
