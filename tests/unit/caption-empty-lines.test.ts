import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { emptyValueLines } from "@/lib/dashboard/caption-format";
import { sparseCaptions, worstCaseCaptions } from "../fixtures/captions";

/**
 * Boş değerli satır bekçisi (canlı prova 2026-11-01): Kasımpaşa–Beşiktaş Maç Günü metninde stadyum API'de
 * yoktu, metin "🏟️ —" satırı taşıyordu. Kural: değeri olmayan alan yazılmaz, bütün alanları boş satır düşer.
 * Bütün şablon metni kurucuları hem en kötü (dolu) hem seyrek (eksik alanlı) veriyle bu bekçiden geçer.
 */

describe("boş değerli satır — kural", () => {
  it("yakalar: tek başına tire, sarkan ayraç, değersiz etiket, yalnız emoji, boş parantez, undefined", () => {
    for (const line of ["🏟️ —", "🏟️ — · 🧑‍⚖️ Ali Palabıyık", "📅 1 Kasım · ⏰ -", "Süper Lig · ", "Hakem: · Saat 19:00", "🏟️", "Kasımpaşa (): A, B", "Stadyum: undefined", "— Kasımpaşa - Beşiktaş"]) {
      assert.deepEqual(emptyValueLines(`Başlık\n${line}\n\nSoru?`), [line], line);
    }
    assert.deepEqual(emptyValueLines("Başlık\nHakem:\n\nSoru?"), ["Hakem:"]);
  });

  it("serbest: paragraf boşluğu, skor, bağlaçlı tire, listeyi açan başlık", () => {
    const ok = ["MAÇ GÜNÜ | Kasımpaşa - Beşiktaş", "", "Galatasaray 2 - 1 Fenerbahçe", "✅ Model: Evet (%69) · Gerçekleşen: Evet — tuttu", "Beşiktaş JK:", "🏠 İç saha: Ajax, Roma", "Son 5: ✅❌", "Sizce kim kazanır? Yorumlara yazın 👇", "#SüperLig #CheckMatch"];
    assert.deepEqual(emptyValueLines(ok.join("\n")), []);
  });
});

describe("bekçi — bütün şablon metinleri", () => {
  it("en kötü durum verisiyle (her aktif tür)", () => {
    for (const { type, caption } of worstCaseCaptions()) assert.deepEqual(emptyValueLines(caption), [], `${type}\n${caption}`);
  });

  it("seyrek veriyle: eksik alanın satırı düşer", () => {
    for (const { type, caption } of sparseCaptions()) assert.deepEqual(emptyValueLines(caption), [], `${type}\n${caption}`);
  });

  it("Maç Günü: stadyum + hakem yoksa satır tamamen düşer, yalnız hakem varsa tek alan", () => {
    const [both, refereeOnly] = sparseCaptions();
    assert.ok(both && refereeOnly);
    assert.doesNotMatch(both.caption, /🏟️|🧑‍⚖️/u);
    assert.match(refereeOnly.caption, /^🧑‍⚖️ Reşat Onur Coşkunses$/mu);
  });
});
