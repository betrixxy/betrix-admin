import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, test } from "node:test";
import { checkLayout, describeLayoutIssues } from "@/lib/dashboard/layout-check";
import { loadBrandLogo } from "@/lib/dashboard/match-day-assets";
import { MATCH_DAY_FRAMES, type MatchDayFrame } from "@/lib/dashboard/match-day-formats";
import { planCrop } from "@/lib/dashboard/match-photo/crop";
import { cropAndGrade } from "@/lib/dashboard/match-photo/grade";
import { shadeStrengthFor, textRegionLuminance } from "@/lib/dashboard/match-photo/legibility";
import { buildMatchResultCard } from "@/lib/dashboard/match-result-card";
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
import type { ColumnSide } from "@/skills/render-engine/templates/checkmatch-set/landscape";
import { matchResultGeometry } from "@/skills/render-engine/templates/match-result/geometry";
import { SET_PAGE_LABELS } from "@/types/checkmatch-set";
import { MATCH_DAY_FORMAT_IDS, type MatchDayFormatId } from "@/types/match-day";
import { MATCH_RESULT_TEMPLATE_IDS, type MatchResultTemplateId } from "@/types/match-result";
import { RAW_GENCLERBIRLIGI_GALATASARAY } from "../fixtures/api-football/match-result";
import { RAW_BESIKTAS_MIDTJYLLAND, RAW_HOFFENHEIM_BESIKTAS_STATS } from "../fixtures/api-football/match-stats";
import { SM_BESIKTAS_MIDTJYLLAND, SM_BESIKTAS_MIDTJYLLAND_IDS, SM_HOFFENHEIM_BESIKTAS, SM_HOFFENHEIM_BESIKTAS_IDS } from "../fixtures/sportmonks/match-stats";
import { diffPng } from "./image-diff";
import { SYNTHETIC_PHOTO_SIZE, syntheticPhoto } from "./synthetic-photo";

/**
 * "CheckMatch set" görsel regresyon testi (bkz. CLAUDE.md 5.3) — tam kadraj Maç Sonucu (01) +
 * İstatistikler (02). Fotoğraf SENTETİKTİR (programatik stadyum sahnesi): gerçek maç fotoğrafları
 * telifli olduğu için repoya girmez. Yüz tespiti/Fal yok: kırpma yüzsüz-merkez planıdır, tonlama ve
 * gradyan gücü gerçek hattan geçer. Ağ yok: logolar `null` (şablonun baş harf yedeği).
 *
 *   - Gençlerbirliği 0-1 Galatasaray (KK, GS altın vurgu): 4 format × (A/B/C 01 + 02); 16:9 hem sağ
 *     hem aynalanmış sol sütunla.
 *   - Beşiktaş 1-0 Midtjylland, Hoffenheim 2-3 Beşiktaş (Avrupa Ligi turuncusu): A 01 + 02, 4:5.
 *   - Her kartta YERLEŞİM ÇAKIŞMA KONTROLÜ: hiçbir blok başka blokla ya da güvenli kenarla çakışmaz.
 *
 *   npm run test:visual                 # karşılaştır
 *   npm run test:visual:update          # baseline'ı yeniden yaz — yalnızca kullanıcı onayıyla (tasarım kararı)
 */

const ROOT = path.join(process.cwd(), "tests", "visual");
const BASELINE_DIR = path.join(ROOT, "__baseline__", "checkmatch-set");
const OUTPUT_DIR = path.join(ROOT, "__output__", "checkmatch-set-diff");
const UPDATE = process.env.npm_lifecycle_event === "test:visual:update" || process.env.UPDATE_BASELINE === "1";
const MAX_DIFF_RATIO = 0.002;

interface Match {
  raw: ApiFootballFixtureResultRaw;
  sportmonks: SportmonksFixture | null;
  ids: { home: number; away: number } | null;
}

const GEN_GS: Match = { raw: RAW_GENCLERBIRLIGI_GALATASARAY, sportmonks: null, ids: null };
const EUROPE: Record<string, Match> = {
  "bjk-mid": { raw: RAW_BESIKTAS_MIDTJYLLAND, sportmonks: SM_BESIKTAS_MIDTJYLLAND, ids: SM_BESIKTAS_MIDTJYLLAND_IDS },
  "hof-bjk": { raw: RAW_HOFFENHEIM_BESIKTAS_STATS, sportmonks: SM_HOFFENHEIM_BESIKTAS, ids: SM_HOFFENHEIM_BESIKTAS_IDS },
};

const PHOTO = syntheticPhoto();
const SOURCE = SYNTHETIC_PHOTO_SIZE;

async function art(frame: MatchDayFrame, accentHex: string, deepHex: string | undefined, side: ColumnSide, template: MatchResultTemplateId) {
  const g = matchResultGeometry(frame, side, template);
  const crop = planCrop({ source: SOURCE, frame, safe: g.photoSafe, faces: [], saliency: null });
  const graded = await cropAndGrade(await PHOTO, crop.box, frame, accentHex, deepHex);
  return { graded, shadeStrength: shadeStrengthFor(await textRegionLuminance(graded, g)) };
}

async function assertLayout(label: string, frame: MatchDayFrame, render: Parameters<typeof checkLayout>[1]) {
  const { issues } = await checkLayout(frame, render);
  assert.equal(issues.length, 0, `${label}: yerleşim çakışması — ${describeLayoutIssues(issues)}`);
}

async function renderSet(match: Match, id: MatchDayFormatId, templates: readonly MatchResultTemplateId[], side: ColumnSide) {
  const frame = MATCH_DAY_FRAMES[id];
  const facts = toMatchResultFacts(match.raw);
  const stats = toMatchStatsFacts(match.raw, match.sportmonks && match.ids ? sportmonksMatchValues(match.sportmonks, match.ids) : null);
  assert.ok(facts && stats, "fixture bitmiş maç olmalı");
  const images = { homeLogo: null, awayLogo: null, leagueLogo: null, brandLogo: await loadBrandLogo() };
  const accentHex = resultAccentHex(facts);
  const deepHex = COMPETITION_COLORS[facts.competition.kind]?.deep;
  const card = buildMatchResultCard(facts, images, null, SET_PAGE_LABELS.RESULT);
  const results: Partial<Record<MatchResultTemplateId, Buffer>> = {};
  for (const template of templates) {
    const { graded, shadeStrength } = await art(frame, accentHex, deepHex, side, template);
    const options = { template, shadeStrength, side };
    await assertLayout(`01 ${template} ${id} ${side}`, frame, (only) => renderMatchResultOverlay(card, frame, { ...options, only }));
    results[template] = await finalizeSetImage(graded, await renderMatchResultOverlay(card, frame, options), frame, facts.fixtureId);
  }
  const statsCard = buildMatchStatsCard(stats, "SUMMARY", images, SET_PAGE_LABELS.STATS);
  await assertLayout(`02 ${id} ${side}`, frame, (only) => renderMatchStatsOverlay(statsCard, frame, { side, only }));
  const base = results.FULL_FRAME ?? Object.values(results)[0];
  assert.ok(base);
  const statsPng = await finalizeSetImage(await buildStatsBackgroundFromResult(frame, base), await renderMatchStatsOverlay(statsCard, frame, { side }), frame, stats.fixtureId);
  return { results, stats: statsPng };
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
  assert.ok(result.diffRatio <= MAX_DIFF_RATIO, `${file}: piksellerin %${(result.diffRatio * 100).toFixed(2)}'si farklı — bkz. tests/visual/__output__/checkmatch-set-diff/`);
}

describe("CheckMatch set (01 + 02) — tam kadraj, görsel regresyon + yerleşim", async () => {
  await rm(OUTPUT_DIR, { recursive: true, force: true });
  await mkdir(UPDATE ? BASELINE_DIR : OUTPUT_DIR, { recursive: true });

  for (const id of MATCH_DAY_FORMAT_IDS) {
    const sides: ColumnSide[] = id === "X_LANDSCAPE" ? ["right", "left"] : ["right"];
    for (const side of sides) {
      test(`gen-gs ${id}${side === "left" ? " (aynalı)" : ""}`, async () => {
        const rendered = await renderSet(GEN_GS, id, MATCH_RESULT_TEMPLATE_IDS, side);
        const suffix = `${id}${side === "left" ? "_mirror" : ""}`;
        for (const template of MATCH_RESULT_TEMPLATE_IDS) await compare(`gen-gs_01-${template}_${suffix}`, rendered.results[template] ?? Buffer.alloc(0));
        await compare(`gen-gs_02-stats_${suffix}`, rendered.stats);
      });
    }
  }

  for (const [name, match] of Object.entries(EUROPE)) {
    test(`${name} IG_PORTRAIT`, async () => {
      const rendered = await renderSet(match, "IG_PORTRAIT", ["FULL_FRAME"], "right");
      await compare(`${name}_01-FULL_FRAME_IG_PORTRAIT`, rendered.results.FULL_FRAME ?? Buffer.alloc(0));
      await compare(`${name}_02-stats_IG_PORTRAIT`, rendered.stats);
    });
  }

  test("aynı kart iki kez çizilince birebir aynı (tohumlu gren)", async () => {
    const [first, second] = [await renderSet(GEN_GS, "IG_PORTRAIT", ["FULL_FRAME"], "right"), await renderSet(GEN_GS, "IG_PORTRAIT", ["FULL_FRAME"], "right")];
    assert.ok(first.results.FULL_FRAME?.equals(second.results.FULL_FRAME ?? Buffer.alloc(0)));
    assert.ok(first.stats.equals(second.stats));
  });
});
