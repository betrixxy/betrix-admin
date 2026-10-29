import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, test } from "node:test";
import { buildDrawCard, type DrawCardInput } from "@/lib/dashboard/draw-card";
import { drawPages, renderDrawImages, renderDrawLayer } from "@/lib/dashboard/draw-render";
import { checkLayout, describeLayoutIssues } from "@/lib/dashboard/layout-check";
import { loadBrandLogo } from "@/lib/dashboard/match-day-assets";
import { MATCH_DAY_FRAMES } from "@/lib/dashboard/match-day-formats";
import { inspectImageBytes } from "@/lib/dashboard/studio-images";
import { MATCH_DAY_FORMAT_IDS, type MatchDayFormatId } from "@/types/match-day";
import { DRAW_KNOCKOUT, DRAW_LEAGUE } from "../fixtures/draw";
import { MAX_DIFF_RATIO, diffPng } from "./image-diff";
import { syntheticPhoto } from "./synthetic-photo";

/**
 * Kura sonucu kartı görsel regresyon testi (bkz. CLAUDE.md 5.3). SENTETİK fotoğraf + kurgusal kura
 * (16 eşleşmeli eleme — C'nin en kalabalık hâli; uzun ad Borussia Mönchengladbach) — ağ, Fal ve AI yok.
 * A eleme · A lig aşaması (2 sayfa) · B temsilcilerimiz · C tüm eşleşmeler × 4 format; her sayfada
 * yerleşim çakışma kontrolü. Baseline YALNIZCA kullanıcı onayıyla; yoksa piksel karşılaştırması atlanır
 * (yerleşim kontrolü yine koşar), çıktı `__output__/draw/` altına bırakılır.
 */

const ROOT = path.join(process.cwd(), "tests", "visual");
const BASELINE_DIR = path.join(ROOT, "__baseline__", "draw");
const OUTPUT_DIR = path.join(ROOT, "__output__", "draw");
const UPDATE = process.env.npm_lifecycle_event === "test:visual:update" || process.env.UPDATE_BASELINE === "1";

const CASES: Record<string, Omit<DrawCardInput, "logos" | "brandLogo">> = {
  "a-eleme": { variant: "TEAM", states: [DRAW_KNOCKOUT], focusTeamId: 163, headToHead: { played: 4, wins: 1, draws: 1, losses: 2 } },
  "a-lig": { variant: "TEAM", states: [DRAW_LEAGUE], focusTeamId: 611 },
  "b-temsilcilerimiz": { variant: "TURKISH", states: [DRAW_LEAGUE] },
  "c-tum-eslesmeler": { variant: "ALL", states: [DRAW_KNOCKOUT] },
};

async function render(name: string, id: MatchDayFormatId): Promise<Buffer[]> {
  const frame = MATCH_DAY_FRAMES[id];
  const built = buildDrawCard({ ...CASES[name]!, logos: {}, brandLogo: await loadBrandLogo() });
  assert.ok(built.ok, built.ok ? "" : built.error.message);
  for (const [index, page] of drawPages(built.data, frame).entries()) {
    const { issues } = await checkLayout(frame, (only) => renderDrawLayer(built.data, page.g, index, only), page.blocks);
    assert.equal(issues.length, 0, `${name} ${id} sayfa ${index + 1}: yerleşim çakışması — ${describeLayoutIssues(issues)}`);
  }
  const image = await inspectImageBytes(await syntheticPhoto(), "sentetik");
  assert.ok(image.ok);
  const result = await renderDrawImages({ card: built.data, frame, photo: image.data, seedKey: `draw-test-${name}` });
  assert.ok(result.ok, result.ok ? "" : result.error.message);
  return result.data;
}

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
  assert.ok(result.diffRatio <= MAX_DIFF_RATIO, `${file}: piksellerin %${(result.diffRatio * 100).toFixed(2)}'si farklı — bkz. tests/visual/__output__/draw/`);
  return true;
}

describe("Kura sonucu — görsel regresyon + yerleşim", async () => {
  await rm(OUTPUT_DIR, { recursive: true, force: true });
  await mkdir(UPDATE ? BASELINE_DIR : OUTPUT_DIR, { recursive: true });

  for (const name of Object.keys(CASES)) {
    for (const id of MATCH_DAY_FORMAT_IDS) {
      test(`${name} ${id}`, async (t) => {
        const pages = await render(name, id);
        const compared = await Promise.all(pages.map((page, index) => compare(`${name}_${id}_${String(index + 1).padStart(2, "0")}`, page)));
        if (!compared.every(Boolean)) t.skip("baseline onay bekliyor — çıktı tests/visual/__output__/draw/ altında");
      });
    }
  }
});
