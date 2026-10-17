import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, test } from "node:test";
import { loadBrandLogo } from "@/lib/dashboard/match-day-assets";
import { MATCH_DAY_FRAMES } from "@/lib/dashboard/match-day-formats";
import { backdropText, renderResultBackdrop } from "@/lib/dashboard/match-result-backdrop";
import { buildMatchResultCard } from "@/lib/dashboard/match-result-card";
import { buildResultBackground, composeResultArt } from "@/lib/dashboard/match-result-compose";
import { renderMatchResultOverlay } from "@/lib/dashboard/match-result-overlay";
import { COMPETITION_COLORS, resultAccentHex } from "@/lib/dashboard/match-result-theme";
import { buildStatsBackgroundFromResult } from "@/lib/dashboard/match-stats-background";
import { buildMatchStatsCard } from "@/lib/dashboard/match-stats-card";
import { renderMatchStatsOverlay } from "@/lib/dashboard/match-stats-overlay";
import { finalizeSetImage } from "@/lib/dashboard/set-finish";
import { toMatchResultFacts } from "@/lib/services/api-football/match-result-mappers";
import { toMatchStatsFacts } from "@/lib/services/api-football/post-match-stats-mappers";
import type { ApiFootballFixtureResultRaw } from "@/lib/services/api-football/types";
import type { SportmonksFixture } from "@/lib/services/sportmonks/advanced-stats-mappers";
import { sportmonksMatchValues } from "@/lib/services/sportmonks/match-stats-mappers";
import { SET_PAGE_LABELS } from "@/types/checkmatch-set";
import { RAW_BESIKTAS_MIDTJYLLAND, RAW_HOFFENHEIM_BESIKTAS_STATS } from "../fixtures/api-football/match-stats";
import { SM_BESIKTAS_MIDTJYLLAND, SM_BESIKTAS_MIDTJYLLAND_IDS, SM_HOFFENHEIM_BESIKTAS, SM_HOFFENHEIM_BESIKTAS_IDS } from "../fixtures/sportmonks/match-stats";
import { diffPng } from "./image-diff";

/**
 * "CheckMatch set" görsel regresyon testi (bkz. CLAUDE.md 5.3): 01 Maç Sonucu + 02 İstatistikler,
 * iki gerçek maç (xG'siz: Beşiktaş 1-0 Midtjylland · xG'li: Hoffenheim 2-3 Beşiktaş), 4:5.
 * Tam set hattı çizilir: programatik zemin + arka plan tipografisi + yazı katmanı + tohumlu gren
 * (01), 01'in bulanık/koyu hâli üstüne istatistik katmanı (02). Ağ yok: logolar `null` (şablonun
 * baş harf yedeği), oyuncu kesimi yok (depoda değil), Fal yok — şablonun kendisi test edilir.
 *
 *   npm run test:visual                 # karşılaştır
 *   npm run test:visual:update          # baseline'ı yeniden yaz — yalnızca kullanıcı onayıyla (tasarım kararı)
 */

const ROOT = path.join(process.cwd(), "tests", "visual");
const BASELINE_DIR = path.join(ROOT, "__baseline__", "checkmatch-set");
const OUTPUT_DIR = path.join(ROOT, "__output__", "checkmatch-set-diff");
const UPDATE = process.env.npm_lifecycle_event === "test:visual:update" || process.env.UPDATE_BASELINE === "1";
const MAX_DIFF_RATIO = 0.002;

const MATCHES: Record<string, { raw: ApiFootballFixtureResultRaw; sportmonks: SportmonksFixture; ids: { home: number; away: number } }> = {
  "bjk-mid": { raw: RAW_BESIKTAS_MIDTJYLLAND, sportmonks: SM_BESIKTAS_MIDTJYLLAND, ids: SM_BESIKTAS_MIDTJYLLAND_IDS },
  "hof-bjk": { raw: RAW_HOFFENHEIM_BESIKTAS_STATS, sportmonks: SM_HOFFENHEIM_BESIKTAS, ids: SM_HOFFENHEIM_BESIKTAS_IDS },
};

async function renderSet(match: (typeof MATCHES)[string]): Promise<{ result: Buffer; stats: Buffer }> {
  const frame = MATCH_DAY_FRAMES.IG_PORTRAIT;
  const result = toMatchResultFacts(match.raw);
  const stats = toMatchStatsFacts(match.raw, sportmonksMatchValues(match.sportmonks, match.ids));
  assert.ok(result && stats, "fixture bitmiş maç olmalı");
  const images = { homeLogo: null, awayLogo: null, leagueLogo: null, brandLogo: await loadBrandLogo() };
  const accent = resultAccentHex(result);
  const background = await buildResultBackground(frame, accent, COMPETITION_COLORS[result.competition.kind]?.deep ?? "#101218");
  const backdrop = await renderResultBackdrop(backdropText(result.outcome, result.home.goals, result.away.goals), frame);
  const art = await composeResultArt(background, frame, [], accent, true, backdrop);
  const resultCard = buildMatchResultCard(result, images, result.mvp?.name ?? null, SET_PAGE_LABELS.RESULT);
  const resultPng = await finalizeSetImage(art, await renderMatchResultOverlay(resultCard, frame), frame, result.fixtureId);
  const statsCard = buildMatchStatsCard(stats, "SUMMARY", images, SET_PAGE_LABELS.STATS);
  const statsPng = await finalizeSetImage(await buildStatsBackgroundFromResult(frame, resultPng), await renderMatchStatsOverlay(statsCard, frame), frame, stats.fixtureId);
  return { result: resultPng, stats: statsPng };
}

describe("CheckMatch set (01 + 02) — görsel regresyon", async () => {
  await rm(OUTPUT_DIR, { recursive: true, force: true });
  await mkdir(UPDATE ? BASELINE_DIR : OUTPUT_DIR, { recursive: true });

  for (const [name, match] of Object.entries(MATCHES)) {
    test(name, async () => {
      const rendered = await renderSet(match);
      for (const [card, actual] of [["01-result", rendered.result], ["02-stats", rendered.stats]] as const) {
        const file = `${name}_${card}_IG_PORTRAIT`;
        const baselinePath = path.join(BASELINE_DIR, `${file}.png`);
        if (UPDATE) {
          await writeFile(baselinePath, actual);
          continue;
        }
        assert.ok(existsSync(baselinePath), `Baseline yok: ${file}.png — önce "npm run test:visual:update" (onaylı) çalıştırın.`);
        const result = await diffPng(actual, await readFile(baselinePath));
        if (result.sizeMismatch || result.diffRatio > MAX_DIFF_RATIO) {
          await writeFile(path.join(OUTPUT_DIR, `${file}.actual.png`), actual);
          if (result.diffPng) await writeFile(path.join(OUTPUT_DIR, `${file}.diff.png`), result.diffPng);
        }
        assert.ok(!result.sizeMismatch, `${file}: boyut değişti`);
        assert.ok(result.diffRatio <= MAX_DIFF_RATIO, `${file}: piksellerin %${(result.diffRatio * 100).toFixed(2)}'si farklı — bkz. tests/visual/__output__/checkmatch-set-diff/`);
      }
    });
  }

  test("aynı kart iki kez çizilince birebir aynı (tohumlu gren)", async () => {
    const [first, second] = [await renderSet(MATCHES["hof-bjk"]!), await renderSet(MATCHES["hof-bjk"]!)];
    assert.ok(first.result.equals(second.result));
    assert.ok(first.stats.equals(second.stats));
  });
});
