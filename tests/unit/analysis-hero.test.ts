import assert from "node:assert/strict";
import { describe, it } from "node:test";
import sharp from "sharp";
import { HERO_SIZE, buildProgrammaticHeroBackground, composeAnalysisHero } from "@/lib/dashboard/analysis-hero-compose";
import { HERO_FILE_PATTERN } from "@/types/deep-analysis";

/** Kurgusal oyuncu kesimi: şeffaf tuval ortasında opak bir dikdörtgen (birefnet çıktısı gibi). */
async function fakeCutout(): Promise<Buffer> {
  const body = await sharp({ create: { width: 300, height: 700, channels: 4, background: { r: 30, g: 80, b: 200, alpha: 1 } } }).png().toBuffer();
  return sharp({ create: { width: 800, height: 1000, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: body, left: 250, top: 150 }])
    .png()
    .toBuffer();
}

describe("kapak kompoziti", () => {
  it("1080×460 üretir, oyuncuyu sağa yerleştirir, alt kenarı kart zeminine eritir", async () => {
    const hero = await composeAnalysisHero(await buildProgrammaticHeroBackground("#A90432"), await fakeCutout());
    const { width, height } = await sharp(hero).metadata();
    assert.deepEqual({ width, height }, HERO_SIZE);

    const { data, info } = await sharp(hero).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const px = (x: number, y: number) => Array.from(data.subarray((y * info.width + x) * 3, (y * info.width + x) * 3 + 3));
    const [r, , b] = px(900, 150);
    assert.ok(b > 150 && r < 100, "sağdaki oyuncu alanında kesimin rengi görünür");
    const bottom = px(540, HERO_SIZE.height - 1);
    assert.ok(bottom.every((c, i) => Math.abs(c - [10, 26, 47][i]!) <= 3), "alt kenar #0a1a2f");
  });

  it("yalnızca kapak motorunun yazdığı depolama dosyasını kabul eder", () => {
    assert.ok(HERO_FILE_PATTERN.test(`/api/files/generated/analysis-hero-${"a".repeat(64)}.png`));
    assert.ok(!HERO_FILE_PATTERN.test("/api/files/renders/x.png"));
    assert.ok(!HERO_FILE_PATTERN.test("https://evil.example/analysis-hero.png"));
    assert.ok(!HERO_FILE_PATTERN.test(`/api/files/generated/analysis-hero-${"a".repeat(64)}.png?x=1`));
  });
});
