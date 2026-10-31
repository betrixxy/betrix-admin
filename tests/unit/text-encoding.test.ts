import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";
import { repairMojibake, sanitizeProviderText, sanitizeProviderTree, stripInvisible } from "@/lib/names/text-encoding";
import { cardPersonName } from "@/lib/names/person-name";
import { tidyText } from "@/skills/render-engine/satori-text";

const ch = (...codes: number[]) => String.fromCharCode(...codes);
/** Canlı test v3 (2026-10-31): API-Football "Relja Obrić" adını "Relja ObriÄ" + U+0087 diye verdi. */
const BROKEN = `R. Obri${ch(0xc4, 0x87)}`;
const INVISIBLE = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u200b-\u200f\u2060\ufeff]/u;

describe("sağlayıcı metni ortak temizleyici", () => {
  test("bozuk kodlama onarılır", () => {
    assert.equal(repairMojibake(BROKEN), "R. Obrić");
    assert.equal(sanitizeProviderText(`Jos${ch(0xc3, 0xa9)}`), "José");
    assert.equal(sanitizeProviderText(`M${ch(0xc3, 0xbc)}ller`), "Müller");
  });

  test("C0/C1 kontrol ve sıfır genişlikli karakterler silinir", () => {
    assert.equal(sanitizeProviderText(`Ar${ch(0x200b)}da${ch(0xfeff)} Güler`), "Arda Güler");
    assert.equal(sanitizeProviderText(`Çakır${ch(0x87)}`), "Çakır");
    assert.equal(sanitizeProviderText(`A${ch(0x00)}B${ch(0x1f)}C${ch(0x7f)}D${ch(0x9f)}`), "ABCD");
    assert.equal(sanitizeProviderText(`${ch(0x200e)}Kasımpaşa${ch(0x202c)}${ch(0x2060)}`), "Kasımpaşa");
  });

  test("boşluklar normalleşir", () => {
    assert.equal(sanitizeProviderText("  Chobani  Stadyumu\tFenerbahçe\nŞükrü Saracoğlu "), "Chobani Stadyumu Fenerbahçe Şükrü Saracoğlu");
    assert.equal(sanitizeProviderText(`Reşat${ch(0xa0)}Onur${ch(0x2009)}Coşkunses`), "Reşat Onur Coşkunses");
    assert.equal(sanitizeProviderText(`Regular${ch(0x3000, 0x3000)}Season - 10`), "Regular Season - 10");
  });

  test("doğru metne dokunulmaz", () => {
    for (const ok of ["Uğurcan Çakır", "Kacper Kozłowski", "Pléa", "Atlético Madrid", "Göztepe SK", "Oh Hyeon-Gyu", "Bodø/Glimt", "Ã"]) {
      assert.equal(sanitizeProviderText(ok), ok);
    }
  });

  test("API yanıt ağacının bütün dizgileri temizlenir, yapı korunur", () => {
    const raw = { fixture: { id: 1, venue: { name: ` Stadio${ch(0x200b)}  Olimpico ` }, referee: `D. Orsato${ch(0x85)}` }, league: { round: "Regular Season\t- 9" }, players: [{ name: BROKEN, rating: "7.2", captain: false, number: null }] };
    assert.deepEqual(sanitizeProviderTree(raw), { fixture: { id: 1, venue: { name: "Stadio Olimpico" }, referee: "D. Orsato" }, league: { round: "Regular Season - 9" }, players: [{ name: "R. Obrić", rating: "7.2", captain: false, number: null }] });
  });

  test("iki istemci de temizleyiciden geçirir (tek kapı)", () => {
    for (const file of ["src/lib/services/api-football/client.ts", "src/lib/services/sportmonks/client.ts"]) {
      assert.match(readFileSync(file, "utf8"), /sanitizeProviderTree\(result\.data\)/u, file);
    }
  });

  test("arşivdeki eski bozuk ad kartta onarılır; render sınırında görünmez karakter kalmaz", () => {
    const name = cardPersonName({ apiName: BROKEN });
    assert.equal(name.name, "Obrić");
    assert.equal(name.short, "R. Obrić");
    assert.ok(!INVISIBLE.test(tidyText(`R. OBRI${ch(0xc4, 0x87)}${ch(0x200b)}`)));
    // Render sınırı şablonun bölünmez boşluğuna dokunmaz.
    assert.equal(stripInvisible(`A${ch(0xa0)}B`), `A${ch(0xa0)}B`);
  });
});
