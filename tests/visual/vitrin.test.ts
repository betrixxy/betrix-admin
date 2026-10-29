import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, test } from "node:test";
import { checkLayout, describeLayoutIssues } from "@/lib/dashboard/layout-check";
import { loadBrandLogo } from "@/lib/dashboard/match-day-assets";
import { MATCH_DAY_FRAMES } from "@/lib/dashboard/match-day-formats";
import { inspectImageBytes } from "@/lib/dashboard/studio-images";
import { buildVitrinCard } from "@/lib/dashboard/vitrin-card";
import { ANALYSIS_BLOCKS, POSTER_BLOCKS, renderVitrinImages, renderVitrinLayer, vitrinGeometries } from "@/lib/dashboard/vitrin-render";
import { scenarioSummary, scenariosFrom } from "@/lib/prediction/internal-source";
import { matchProbabilities } from "@/lib/prediction/poisson";
import { MATCH_DAY_FORMAT_IDS, type MatchDayFormatId } from "@/types/match-day";
import type { PredictionSet } from "@/types/prediction";
import { MAX_DIFF_RATIO, diffPng } from "./image-diff";
import { syntheticPhoto } from "./synthetic-photo";

/**
 * Maç önü vitrin carousel'i (01 Poster + 02 Analiz) görsel regresyon testi (bkz. CLAUDE.md 5.3). SENTETİK fotoğraf + SENTETİK
 * tahmin seti (sabit λ, sabit ≤10 sözcük gerekçeler, sabit zaman) — ağ, Fal ve AI yok. 4 format × 2 sayfa; her birinde
 * yerleşim çakışma kontrolü. Baseline güncellemesi yalnızca kullanıcı onayıyla (tasarım kararı).
 */

const ROOT = path.join(process.cwd(), "tests", "visual");
const BASELINE_DIR = path.join(ROOT, "__baseline__", "vitrin");
const OUTPUT_DIR = path.join(ROOT, "__output__", "vitrin-diff");
const UPDATE = process.env.npm_lifecycle_event === "test:visual:update" || process.env.UPDATE_BASELINE === "1";

const REASONS: Record<string, string> = {
  RESULT_1X2: "Galatasaray son 5 maçında 4 galibiyet aldı.",
  BTTS: "Kasımpaşa maç başı 1,4 gol atıyor.",
};

function syntheticPrediction(): PredictionSet {
  const p = matchProbabilities({ home: 1.75, away: 0.95 });
  const scenarios = scenariosFrom(p).map((scenario) => ({ ...scenario, reason: REASONS[scenario.id] ?? "" }));
  return { sourceId: "internal", sourceVersion: "poisson-v1", computedAtUtc: "2026-10-20T10:00:00.000Z", scenarios, ...scenarioSummary(scenarios, p) };
}

async function card() {
  return buildVitrinCard(
    syntheticPrediction(),
    { open: ["RESULT_1X2", "BTTS"], locked: ["HT_RESULT", "GOALS_4PLUS", "COMBO"] },
    { sides: { home: "Galatasaray", away: "Kasımpaşa" }, homeTeamId: 645, awayTeamId: 3563, kickoffUtc: "2026-10-24T17:00:00Z", competitionName: "Trendyol Süper Lig", roundLabel: "9. Hafta", homeForm: ["W", "W", "D", "W", "W"], awayForm: ["L", "D", "L", "W", "L"] },
    { homeLogo: null, awayLogo: null, brandLogo: await loadBrandLogo() },
  );
}

/** [01 Poster, 02 Analiz] — iki sayfanın da yerleşim kontrolüyle. İki taraf aynı sentetik fotoğraf. */
async function render(id: MatchDayFormatId): Promise<[Buffer, Buffer]> {
  const frame = MATCH_DAY_FRAMES[id];
  const vitrin = await card();
  const { poster, analysis } = vitrinGeometries(frame);
  for (const [g, blocks] of [[poster, POSTER_BLOCKS], [analysis, ANALYSIS_BLOCKS]] as const) {
    const { issues } = await checkLayout(frame, (only) => renderVitrinLayer(vitrin, g, only), blocks);
    assert.equal(issues.length, 0, `${id} ${g.page}: yerleşim çakışması — ${describeLayoutIssues(issues)}`);
  }
  const image = await inspectImageBytes(await syntheticPhoto(), "sentetik");
  assert.ok(image.ok);
  const result = await renderVitrinImages({ card: vitrin, frame, photos: { home: image.data, away: image.data }, seedKey: "api-football-vitrin-test" });
  assert.ok(result.ok, result.ok ? "" : result.error.message);
  return result.data;
}

async function compare(file: string, actual: Buffer) {
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
  assert.ok(!result.sizeMismatch, `${file}: boyut değişti`);
  assert.ok(result.diffRatio <= MAX_DIFF_RATIO, `${file}: piksellerin %${(result.diffRatio * 100).toFixed(2)}'si farklı — bkz. tests/visual/__output__/vitrin-diff/`);
}

describe("Maç önü vitrin carousel'i — görsel regresyon + yerleşim", async () => {
  await rm(OUTPUT_DIR, { recursive: true, force: true });
  await mkdir(UPDATE ? BASELINE_DIR : OUTPUT_DIR, { recursive: true });

  for (const id of MATCH_DAY_FORMAT_IDS) {
    test(`gs-kas ${id}`, async () => {
      const [poster, analysis] = await render(id);
      await compare(`gs-kas_${id}_01-poster`, poster);
      await compare(`gs-kas_${id}_02-analiz`, analysis);
    });
  }

  test("aynı kart iki kez çizilince birebir aynı (tohumlu gren)", async () => {
    const [first, second] = [await render("IG_PORTRAIT"), await render("IG_PORTRAIT")];
    assert.ok(first[0].equals(second[0]) && first[1].equals(second[1]));
  });
});
