import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { formatStatValue } from "@/lib/dashboard/match-stats-rows";
import { formatNumber } from "@/lib/format/number";

/**
 * Sayı yazımı tek kaynak (`lib/format/number.ts`): tr-TR, ondalık virgül. Kartlarda ve gönderi metinlerinde
 * `toFixed` / elle "." → "," / dağınık `toLocaleString` kalmaz — kaynak taramasıyla sabit (2026-10-27:
 * Maç Günü "GOL ORTALAMASI 1.8").
 */

describe("formatNumber", () => {
  it("ondalık virgül, sondaki sıfır yok", () => {
    assert.equal(formatNumber(1.8), "1,8");
    assert.equal(formatNumber(0.72), "0,72");
    assert.equal(formatNumber(2), "2");
    assert.equal(formatNumber(-0), "0");
  });

  it("sabit basamak ve üst sınır", () => {
    assert.equal(formatNumber(1.16, { decimals: 2 }), "1,16");
    assert.equal(formatNumber(2, { decimals: 1 }), "2,0");
    assert.equal(formatNumber(1.84, { maxDecimals: 1 }), "1,8");
    assert.equal(formatNumber(1528), "1.528");
  });

  it("istatistik satırı da aynı katmandan", () => {
    assert.equal(formatStatValue("xg", 1.16), "1,16");
  });
});

/** Kart metni üreten kaynaklar: şablonlar, kart/metin kurucuları. */
const ROOTS = ["src/skills/render-engine/templates", "src/lib/player-h2h", "src/lib/draw", "src/lib/dashboard", "src/lib/prediction"];
const CARD_TEXT = /templates|player-h2h|[/\\]draw[/\\]|-card\.ts|-caption\.ts|studio-stats\.ts|studio-render\.ts|match-stats-rows\.ts|deep-analysis-insights\.ts|reasons\.ts|-labels\.ts/;
/** SVG geometrisi (koordinat, gradyan durağı, yazı boyu) metin değildir. */
const GEOMETRY = /d=\{|stop-|offset=|font-size=|toFixed\(3\)/;

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? files(full) : /\.tsx?$/.test(name) ? [full] : [];
  });
}

describe("kaynak taraması — kart metninde ham ondalık yazımı yok", () => {
  it("toFixed / elle virgül / toLocaleString yalnızca ortak katmanda", () => {
    const offenders: string[] = [];
    for (const file of ROOTS.flatMap(files).filter((f) => CARD_TEXT.test(f))) {
      readFileSync(file, "utf8")
        .split("\n")
        .forEach((line, index) => {
          if (GEOMETRY.test(line)) return;
          if (/\.toFixed\(|\.replace\("\.", ","\)|toLocaleString\(/.test(line) && !/ondalık ayırıcı virgül olmalı/.test(line)) offenders.push(`${file}:${index + 1}`);
        });
    }
    assert.deepEqual(offenders, []);
  });
});
