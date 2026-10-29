import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, test } from "node:test";
import { weeklyLayout, weeklyPlan } from "@/lib/dashboard/weekly-fixtures-layout";
import { SOCIAL_FORMATS, SOCIAL_FORMAT_IDS } from "@/types/studio-formats";
import { WEEKLY_CASES } from "../fixtures/studio-cards";
import { diffPng } from "./image-diff";
import { STUDIO_CARDS, renderStudioCase, studioCases, weeklyCase } from "./studio-cards-render";

/**
 * Stüdyo kartları görsel regresyon testi (bkz. CLAUDE.md 5.3): Muhtemel 11, Haftanın Maçları, Puan
 * Durumu ve Derin Analiz × 4 format × senaryo (Türkçe karakterli ad, yabancı ad, uzun ad, iki satırlık
 * metin). KURGUSAL veri, logo/fotoğraf yok — ağ, Fal ve AI yok. Baseline YALNIZCA kullanıcı onayıyla.
 */

const ROOT = path.join(process.cwd(), "tests", "visual");
const BASELINE_DIR = path.join(ROOT, "__baseline__", "studio-cards");
const OUTPUT_DIR = path.join(ROOT, "__output__", "studio-cards");
const UPDATE = process.env.npm_lifecycle_event === "test:visual:update" || process.env.UPDATE_BASELINE === "1";
/**
 * Sıkı eşik (%0,002 ≈ 4:5'te 27 piksel): çizim aynı makinede bayt bayt deterministik. Diğer testlerin
 * %0,2'si küçük punto değişikliğini (tek harf, tarih biçimi — kartın %0,1–0,3'ü) yakalamıyordu.
 */
const MAX_DIFF_RATIO = 0.00002;

describe("Stüdyo kartları — görsel regresyon", async () => {
  await rm(OUTPUT_DIR, { recursive: true, force: true });
  await mkdir(UPDATE ? BASELINE_DIR : OUTPUT_DIR, { recursive: true });

  for (const card of STUDIO_CARDS) {
    for (const name of studioCases(card)) {
      for (const format of SOCIAL_FORMAT_IDS) {
        const file = `${card}_${name}_${format}`;

        test(file, async () => {
          if (card === "weekly") {
            // Kartın taşıdığı maç sayısı da sabitlenir: yerleşim değişip daha az maç sığarsa test görür.
            const input = weeklyCase(name, format);
            assert.ok(weeklyPlan(input.matches, input.grouping, weeklyLayout(format)), `${file}: maçlar karta sığmıyor`);
            assert.ok(input.matches.length >= Math.min(WEEKLY_CASES[name]!.matches.length, 7), `${file}: yalnızca ${input.matches.length} maç sığıyor`);
          }
          const actual = await renderStudioCase(card, name, format);
          const baselinePath = path.join(BASELINE_DIR, `${file}.png`);
          if (UPDATE) {
            await writeFile(baselinePath, actual);
            return;
          }
          assert.ok(existsSync(baselinePath), `Baseline yok: ${file}.png — önce "npm run test:visual:update" (onaylı) çalıştırın.`);

          const result = await diffPng(actual, await readFile(baselinePath));
          if (result.sizeMismatch || result.diffRatio > MAX_DIFF_RATIO) {
            await writeFile(path.join(OUTPUT_DIR, `${file}.actual.png`), actual);
            if (result.diffPng) await writeFile(path.join(OUTPUT_DIR, `${file}.diff.png`), result.diffPng);
          }
          const { width, height } = SOCIAL_FORMATS[format];
          assert.ok(!result.sizeMismatch, `${file}: boyut değişti (${width}×${height} bekleniyordu)`);
          assert.ok(result.diffRatio <= MAX_DIFF_RATIO, `${file}: piksellerin %${(result.diffRatio * 100).toFixed(2)}'si farklı — bkz. tests/visual/__output__/studio-cards/`);
        });
      }
    }
  }
});
