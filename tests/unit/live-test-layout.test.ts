import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import sharp from "sharp";
import { MATCH_DAY_FRAMES } from "@/lib/dashboard/match-day-formats";
import { BACKDROP_MAX_DARKEN, BACKDROP_MAX_LUMA, BACKDROP_MIN_DARKEN, backdropDarkenFor, brightLuminance } from "@/lib/dashboard/match-photo/legibility";
import { TOP_PLAYERS_TITLE } from "@/lib/dashboard/player-stats-card";
import { MAX_FACT_LINES, halvesGeometry, wrapFact } from "@/skills/render-engine/templates/match-analysis/geometry";
import { topPlayersGeometry } from "@/skills/render-engine/templates/player-stats/geometry";

/**
 * Canlı test 2026-10-31 yerleşim düzeltmeleri: Maç Analizi 02 olgu sarması (Fiorentina–Atalanta), set zemininin okunurluk
 * kuralıyla karartılması (02–06 neredeyse siyahtı), B3 etiket tekrarı ve başlık–liste boşluğu.
 */

const FIO = "Fiorentina ikinci yarıda topa sahip olmada 14 puan artış yakaladı (%38 → %52).";

describe("Maç Analizi 02 olguları", () => {
  it("uzun olgu elle iki satıra bölünür (eskiden tek satır kalıp sağdan 18px taşıyordu)", () => {
    const lines = wrapFact(FIO, 924, 25);
    assert.equal(lines.length, 2);
    assert.ok(lines.every((line) => !line.includes(" ")), "satırlar bölünmez boşluklu (tight)");
  });

  it("konya-gs olgusu tek satırda kalır (baseline korunur)", () => {
    assert.equal(wrapFact("Galatasaray iki yarıda da rakibinden çok şut çekti: ilk yarı 8, ikinci yarı 8.", 924, 25).length, 1);
  });

  it("sığmayan / çok uzun olgu düşer, cümle kırpılmaz", () => {
    const long = Array.from({ length: 6 }, () => "Atalanta ikinci yarıda şut sayısını 3 katından fazlasına çıkardı (2 → 7).").join(" ");
    const g = halvesGeometry(MATCH_DAY_FRAMES.IG_PORTRAIT, 5, [FIO, long, "Atalanta geriye düştüğü maçta skoru eşitledi."]);
    assert.ok(g.factTexts.every((lines) => lines.length <= MAX_FACT_LINES));
    assert.equal(g.factTexts.length, 2);
    assert.ok(g.rowHeight >= Math.round(70 * g.k));
  });
});

describe("set zemini okunurluk kuralı", () => {
  it("koyu zemin az, açık zemin çok karartılır; sınırlar içinde", () => {
    assert.equal(backdropDarkenFor(0.1), BACKDROP_MIN_DARKEN);
    assert.ok(backdropDarkenFor(1) > 0.7 && backdropDarkenFor(1) <= BACKDROP_MAX_DARKEN);
    const mid = backdropDarkenFor(0.6);
    assert.ok(mid > BACKDROP_MIN_DARKEN && mid < BACKDROP_MAX_DARKEN);
    // Açık bölge karartma sonrası eşiği aşmaz (beyaz yazı ≥ 7:1).
    assert.ok(0.6 * (1 - mid) <= BACKDROP_MAX_LUMA + 0.01);
  });

  it("parlaklık ölçümü açık bölgeyi görür", async () => {
    const dark = await sharp({ create: { width: 90, height: 160, channels: 3, background: "#101010" } }).png().toBuffer();
    const bright = await sharp({ create: { width: 90, height: 160, channels: 3, background: "#d0d0d0" } }).png().toBuffer();
    assert.ok((await brightLuminance(dark)) < 0.1);
    assert.ok((await brightLuminance(bright)) > 0.7);
  });
});

describe("B · Maçın En İyileri", () => {
  it("set etiketi büyük başlığı tekrar etmez", () => {
    // Motor modülü env okur (birim testte yüklenmez) — etiket kaynaktan okunur.
    const label = /TOP_PLAYERS: "([^"]+)"/u.exec(readFileSync("src/lib/dashboard/player-stats-engine.ts", "utf8"))?.[1];
    assert.ok(label);
    assert.notEqual(label, TOP_PLAYERS_TITLE);
  });

  it("dikeyde üç satır alanı doldurur: başlık–liste boşluğu ≤ 80px", () => {
    for (const id of ["IG_PORTRAIT", "STORY"] as const) {
      const g = topPlayersGeometry(MATCH_DAY_FRAMES[id], { rows: [1, 2, 3] as never });
      const gap = g.rowsArea.top - (g.title.top + g.title.height);
      assert.ok(gap <= 80, `${id}: ${gap}px`);
    }
  });
});
