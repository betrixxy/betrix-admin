import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, test } from "node:test";
import { MATCH_DAY_FRAMES } from "@/lib/dashboard/match-day-formats";
import { matchDayLayoutGate, renderMatchDayOverlay } from "@/lib/dashboard/match-day-overlay";
import { MATCH_DAY_FORMAT_IDS, MATCH_DAY_TEMPLATE_IDS } from "@/types/match-day";
import { MATCH_DAY_SCENARIOS } from "../fixtures/match-day/cards";
import { MAX_DIFF_RATIO, diffPng } from "./image-diff";

/**
 * Maç Günü tipografi katmanı görsel regresyon testi (bkz. CLAUDE.md 5.3):
 * 3 şablon × 4 format × 4 veri senaryosu (biri gerçek veri anlık görüntüsü) = 48 Satori çizimi, `__baseline__/`
 * ile karşılaştırılır; her çizimde yerleşim kapısı da koşar (logo dahil bütün bloklar, üretimdekiyle aynı).
 *
 *   npm run test:visual                 # karşılaştır
 *   npm run test:visual:update          # baseline'ı yeniden yaz — yalnızca kullanıcı onayıyla (tasarım kararı)
 *
 * Fark çıkarsa gerçek çıktı ve kırmızı işaretli fark görseli `__output__/`'a yazılır (gitignore'da).
 * Fal.ai'ye gidilmez; AI görseli değil, şablonun kendisi test edilir.
 */

const ROOT = path.join(process.cwd(), "tests", "visual");
const BASELINE_DIR = path.join(ROOT, "__baseline__", "match-day");
const OUTPUT_DIR = path.join(ROOT, "__output__", "match-day");
// npm script adından okunur: `VAR=1 komut` sözdizimi Windows'ta (cmd) çalışmaz.
const UPDATE = process.env.npm_lifecycle_event === "test:visual:update" || process.env.UPDATE_BASELINE === "1";

describe("Maç Günü şablonları — görsel regresyon", async () => {
  await rm(OUTPUT_DIR, { recursive: true, force: true });
  await mkdir(UPDATE ? BASELINE_DIR : OUTPUT_DIR, { recursive: true });

  for (const [scenario, card] of Object.entries(MATCH_DAY_SCENARIOS)) {
    for (const template of MATCH_DAY_TEMPLATE_IDS) {
      for (const format of MATCH_DAY_FORMAT_IDS) {
        const name = `${scenario}_${template}_${format}`;

        test(name, async () => {
          const frame = MATCH_DAY_FRAMES[format];
          // Yerleşim kapısı: logo dahil bütün bloklar (üretimde de aynı kapı, bkz. match-day-engine.ts).
          const gate = await matchDayLayoutGate(card, template, frame);
          assert.ok(gate.ok, gate.ok ? "" : `${name}: ${gate.error.message}`);
          const actual = await renderMatchDayOverlay(card, template, frame);
          const baselinePath = path.join(BASELINE_DIR, `${name}.png`);

          if (UPDATE) {
            await writeFile(baselinePath, actual);
            return;
          }
          assert.ok(existsSync(baselinePath), `Baseline yok: ${name}.png — önce "npm run test:visual:update" (onaylı) çalıştırın.`);

          const result = await diffPng(actual, await readFile(baselinePath));
          if (result.sizeMismatch || result.diffRatio > MAX_DIFF_RATIO) {
            await writeFile(path.join(OUTPUT_DIR, `${name}.actual.png`), actual);
            if (result.diffPng) await writeFile(path.join(OUTPUT_DIR, `${name}.diff.png`), result.diffPng);
          }
          assert.ok(!result.sizeMismatch, `${name}: boyut değişti (${frame.width}×${frame.height} bekleniyordu)`);
          assert.ok(
            result.diffRatio <= MAX_DIFF_RATIO,
            `${name}: piksellerin %${(result.diffRatio * 100).toFixed(3)}'ü farklı (eşik %${(MAX_DIFF_RATIO * 100).toFixed(3)}) — bkz. tests/visual/__output__/match-day/`,
          );
        });
      }
    }
  }
});
