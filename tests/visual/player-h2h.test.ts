import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, test } from "node:test";
import { checkLayout, describeLayoutIssues } from "@/lib/dashboard/layout-check";
import { loadBrandLogo } from "@/lib/dashboard/match-day-assets";
import { MATCH_DAY_FRAMES } from "@/lib/dashboard/match-day-formats";
import { buildH2HCard } from "@/lib/dashboard/player-h2h-card";
import { H2H_COMPARE_BLOCKS, H2H_POSTER_BLOCKS, h2hGeometries, renderH2HImages, renderH2HLayer } from "@/lib/dashboard/player-h2h-render";
import { inspectImageBytes } from "@/lib/dashboard/studio-images";
import { MATCH_DAY_FORMAT_IDS, type MatchDayFormatId } from "@/types/match-day";
import { H2H_LEFT, H2H_RIGHT } from "../fixtures/player-h2h";
import { diffPng } from "./image-diff";
import { syntheticPhoto } from "./synthetic-photo";

/**
 * Oyuncu karşılaştırması (01 Poster + 02 İstatistikler) görsel regresyon testi (bkz. CLAUDE.md 5.3).
 * SENTETİK fotoğraf + kurgusal sezon verisi (havuzun tamamı; uzun ad: Borussia Mönchengladbach) — ağ,
 * Fal ve AI yok. 4 format × 2 sayfa; her birinde yerleşim çakışma kontrolü. Baseline YALNIZCA
 * kullanıcı onayıyla yazılır (tasarım kararı); baseline yoksa piksel karşılaştırması atlanır (yerleşim
 * kontrolü yine koşar) ve çıktı `__output__/player-h2h/` altına bırakılır.
 */

const ROOT = path.join(process.cwd(), "tests", "visual");
const BASELINE_DIR = path.join(ROOT, "__baseline__", "player-h2h");
const OUTPUT_DIR = path.join(ROOT, "__output__", "player-h2h");
const UPDATE = process.env.npm_lifecycle_event === "test:visual:update" || process.env.UPDATE_BASELINE === "1";
const MAX_DIFF_RATIO = 0.002;

async function render(id: MatchDayFormatId) {
  const frame = MATCH_DAY_FRAMES[id];
  const built = buildH2HCard({
    left: H2H_LEFT,
    right: H2H_RIGHT,
    mode: "PER90",
    match: { homeTeam: "Fenerbahçe", awayTeam: "Borussia Mönchengladbach", kickoffUtc: "2026-11-05T17:45:00Z", homeOrigin: "tr", awayOrigin: "intl" },
    images: { leftLogo: null, rightLogo: null, leftFace: null, rightFace: null, brandLogo: await loadBrandLogo() },
    frame,
  });
  assert.ok(built.ok, built.ok ? "" : built.error.message);
  const { card } = built.data;
  const { poster, compare } = h2hGeometries(frame);
  for (const [g, blocks] of [[poster, H2H_POSTER_BLOCKS], [compare, H2H_COMPARE_BLOCKS]] as const) {
    const { issues } = await checkLayout(frame, (only) => renderH2HLayer(card, g, only), blocks);
    assert.equal(issues.length, 0, `${id} ${g.page}: yerleşim çakışması — ${describeLayoutIssues(issues)}`);
  }
  const image = await inspectImageBytes(await syntheticPhoto(), "sentetik");
  assert.ok(image.ok);
  const result = await renderH2HImages({ card, frame, photos: { home: image.data, away: image.data }, seedKey: "h2h-test" });
  assert.ok(result.ok, result.ok ? "" : result.error.message);
  return { pages: result.data, rows: card.rows.length };
}

/** Baseline varsa piksel karşılaştırması; yoksa çıktı incelemeye bırakılır ve karşılaştırma atlanır. */
async function compare(file: string, actual: Buffer): Promise<boolean> {
  const baselinePath = path.join(BASELINE_DIR, `${file}.png`);
  if (UPDATE) {
    await writeFile(baselinePath, actual);
    return true;
  }
  if (!existsSync(baselinePath)) {
    await writeFile(path.join(OUTPUT_DIR, `${file}.actual.png`), actual);
    return false;
  }
  const result = await diffPng(actual, await readFile(baselinePath));
  if (result.sizeMismatch || result.diffRatio > MAX_DIFF_RATIO) {
    await writeFile(path.join(OUTPUT_DIR, `${file}.actual.png`), actual);
    if (result.diffPng) await writeFile(path.join(OUTPUT_DIR, `${file}.diff.png`), result.diffPng);
  }
  assert.ok(!result.sizeMismatch, `${file}: boyut değişti`);
  assert.ok(result.diffRatio <= MAX_DIFF_RATIO, `${file}: piksellerin %${(result.diffRatio * 100).toFixed(2)}'si farklı — bkz. tests/visual/__output__/player-h2h/`);
  return true;
}

describe("Oyuncu karşılaştırması — görsel regresyon + yerleşim", async () => {
  await rm(OUTPUT_DIR, { recursive: true, force: true });
  await mkdir(UPDATE ? BASELINE_DIR : OUTPUT_DIR, { recursive: true });

  for (const id of MATCH_DAY_FORMAT_IDS) {
    test(`aktürkoğlu-pléa ${id}`, async (t) => {
      const { pages, rows } = await render(id);
      assert.ok(rows >= 8, `${id}: yalnızca ${rows} satır sığdı`);
      const compared = [await compare(`akturkoglu-plea_${id}_01-poster`, pages[0]), await compare(`akturkoglu-plea_${id}_02-istatistik`, pages[1])];
      if (!compared.every(Boolean)) t.skip("baseline onay bekliyor — çıktı tests/visual/__output__/player-h2h/ altında");
    });
  }

  test("aynı kart iki kez çizilince birebir aynı (tohumlu gren)", async () => {
    const [first, second] = [await render("IG_PORTRAIT"), await render("IG_PORTRAIT")];
    assert.ok(first.pages[0].equals(second.pages[0]) && first.pages[1].equals(second.pages[1]));
  });
});
