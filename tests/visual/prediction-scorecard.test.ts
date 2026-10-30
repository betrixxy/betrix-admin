import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, test } from "node:test";
import { checkLayout, describeLayoutIssues } from "@/lib/dashboard/layout-check";
import { loadBrandLogo } from "@/lib/dashboard/match-day-assets";
import { MATCH_DAY_FRAMES } from "@/lib/dashboard/match-day-formats";
import { buildMatchScorecardCard, buildPeriodScorecardCard } from "@/lib/dashboard/prediction-scorecard-card";
import { renderScorecardImage, renderScorecardOverlay } from "@/lib/dashboard/prediction-scorecard-render";
import { buildMatchScorecard, buildPeriodScorecard } from "@/lib/prediction/scorecard";
import { periodFor } from "@/lib/prediction/scorecard-period";
import { MATCH_DAY_FORMAT_IDS, type MatchDayFormatId } from "@/types/match-day";
import type { ScorecardRecord } from "@/types/prediction-scorecard";
import type { ScorecardCard } from "@/types/prediction-scorecard-card";
import { KONYA_GS, KONYA_GS_ALL_SIX, KONYA_GS_RECORDS, octoberEntries } from "../fixtures/prediction-scorecard";
import { MAX_DIFF_RATIO, diffPng } from "./image-diff";

/**
 * Tahmin Karnesi görsel testi (bkz. CLAUDE.md 5.3) — A · maç karnesi (2 kayıt: Vitrin onayının yazdığı gibi;
 * 6 kayıt: en kalabalık hâl) + B · dönem karnesi (7 kayıt: küçük örneklem; 24 kayıt: isabet oranı + model
 * sürümü ayrımı) × 4 format. Kayıtlar SENTETİK (prod'da kayıt yok). Ağ yok: logolar yok. Her kartta YERLEŞİM
 * KAPISI.
 *
 * Baseline onaylı (2026-10-31; prediction-scorecard 16, match-analysis 20). Baseline dosyası yoksa yalnızca yerleşim kapısı koşar ve çıktı
 * `__output__/prediction-scorecard/` altına yazılır; baseline varsa piksel karşılaştırması yapılır.
 *   UPDATE_BASELINE=1 npx tsx --test tests/visual/prediction-scorecard.test.ts   # yalnızca kullanıcı onayıyla
 */

const ROOT = path.join(process.cwd(), "tests", "visual");
const BASELINE_DIR = path.join(ROOT, "__baseline__", "prediction-scorecard");
const OUTPUT_DIR = path.join(ROOT, "__output__", "prediction-scorecard");
const UPDATE = process.env.npm_lifecycle_event === "test:visual:update" || process.env.UPDATE_BASELINE === "1";

const sides = { home: KONYA_GS.home.name, away: KONYA_GS.away.name };
const october = periodFor("MONTH", new Date("2026-10-15T12:00:00Z"));

async function matchCard(records: ScorecardRecord[]): Promise<ScorecardCard> {
  const built = buildMatchScorecard({ fixtureId: KONYA_GS.fixtureId, sides, score: KONYA_GS.score, records });
  assert.ok(built.ok, built.ok ? "" : built.error.message);
  return buildMatchScorecardCard({ match: KONYA_GS, data: built.data, brandLogo: await loadBrandLogo() });
}

async function periodCard(count: number): Promise<ScorecardCard> {
  const built = buildPeriodScorecard({ period: october, entries: octoberEntries(count), splitByModelVersion: true });
  assert.ok(built.ok, built.ok ? "" : built.error.message);
  return buildPeriodScorecardCard({ data: built.data, brandLogo: await loadBrandLogo() });
}

async function render(label: string, card: ScorecardCard, id: MatchDayFormatId): Promise<Buffer> {
  const frame = MATCH_DAY_FRAMES[id];
  const { issues } = await checkLayout(frame, (only) => renderScorecardOverlay(card, frame, { only }));
  assert.equal(issues.length, 0, `${label} ${id}: yerleşim çakışması — ${describeLayoutIssues(issues)}`);
  const rendered = await renderScorecardImage({ card, frame, resultImage: null, seedKey: `karne-${label}` });
  assert.ok(rendered.ok, rendered.ok ? "" : rendered.error.message);
  return rendered.data;
}

async function compare(file: string, actual: Buffer) {
  const baselinePath = path.join(BASELINE_DIR, `${file}.png`);
  if (UPDATE) {
    await writeFile(baselinePath, actual);
    return;
  }
  if (!existsSync(baselinePath)) {
    // Baseline onay bekliyor: çıktıyı incelemeye bırak, karşılaştırma yok.
    await writeFile(path.join(OUTPUT_DIR, `${file}.png`), actual);
    return;
  }
  const result = await diffPng(actual, await readFile(baselinePath));
  if (result.sizeMismatch || result.diffRatio > MAX_DIFF_RATIO) {
    await writeFile(path.join(OUTPUT_DIR, `${file}.actual.png`), actual);
    if (result.diffPng) await writeFile(path.join(OUTPUT_DIR, `${file}.diff.png`), result.diffPng);
  }
  assert.ok(!result.sizeMismatch, `${file}: boyut değişti`);
  assert.ok(result.diffRatio <= MAX_DIFF_RATIO, `${file}: piksellerin %${(result.diffRatio * 100).toFixed(2)}'si farklı — bkz. tests/visual/__output__/prediction-scorecard/`);
}

describe("Tahmin Karnesi (A + B) — görsel + yerleşim", async () => {
  await rm(OUTPUT_DIR, { recursive: true, force: true });
  await mkdir(UPDATE ? BASELINE_DIR : OUTPUT_DIR, { recursive: true });
  const cards: [string, ScorecardCard][] = [
    ["match-2", await matchCard(KONYA_GS_RECORDS)],
    ["match-6", await matchCard(KONYA_GS_ALL_SIX)],
    ["period-7", await periodCard(7)],
    ["period-24", await periodCard(24)],
  ];
  for (const [label, card] of cards) {
    for (const id of MATCH_DAY_FORMAT_IDS) {
      test(`${label} × ${id}`, async () => {
        await compare(`${label}-${id.toLowerCase()}`, await render(label, card, id));
      });
    }
  }
});
