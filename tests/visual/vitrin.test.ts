import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, test } from "node:test";
import { checkLayout, describeLayoutIssues } from "@/lib/dashboard/layout-check";
import { loadBrandLogo } from "@/lib/dashboard/match-day-assets";
import { MATCH_DAY_FRAMES } from "@/lib/dashboard/match-day-formats";
import { inspectImageBytes } from "@/lib/dashboard/studio-images";
import { buildVitrinCaption } from "@/lib/dashboard/vitrin-caption";
import { buildVitrinCard, type VitrinMeta } from "@/lib/dashboard/vitrin-card";
import { ANALYSIS_BLOCKS, POSTER_BLOCKS, renderVitrinImages, renderVitrinLayer, vitrinGeometries } from "@/lib/dashboard/vitrin-render";
import { scenarioSummary, scenariosFrom } from "@/lib/prediction/internal-source";
import { matchProbabilities } from "@/lib/prediction/poisson";
import { MATCH_DAY_FORMAT_IDS, type MatchDayFormatId } from "@/types/match-day";
import type { PredictionSet } from "@/types/prediction";
import type { VitrinCard } from "@/types/vitrin";
import { MAX_DIFF_RATIO, diffPng } from "./image-diff";
import { syntheticPhoto } from "./synthetic-photo";

/**
 * Maç önü vitrin carousel'i (01 Poster + 02 Analiz) görsel regresyon testi (bkz. CLAUDE.md 5.3). SENTETİK fotoğraf + SENTETİK
 * tahmin seti (sabit λ, sabit ≤10 sözcük gerekçeler, sabit zaman) — ağ, Fal ve AI yok. 4 format × 2 sayfa; her birinde
 * yerleşim çakışma kontrolü. Baseline güncellemesi yalnızca kullanıcı onayıyla (tasarım kararı).
 * İki maç: Galatasaray–Kasımpaşa (Türk adları) ve Inter–Borussia Dortmund (yabancı ad + UEFA: "INTER",
 * "BORUSSIA" — Türkçe İ/ı yok; gönderi metni "Borussia", "UEFA"; 02 göstergesinde takım adı).
 */

const ROOT = path.join(process.cwd(), "tests", "visual");
const BASELINE_DIR = path.join(ROOT, "__baseline__", "vitrin");
const OUTPUT_DIR = path.join(ROOT, "__output__", "vitrin-diff");
const UPDATE = process.env.npm_lifecycle_event === "test:visual:update" || process.env.UPDATE_BASELINE === "1";

const REASONS: Record<string, string> = {
  RESULT_1X2: "Galatasaray son 5 maçında 4 galibiyet aldı.",
  BTTS: "Kasımpaşa maç başı 1,4 gol atıyor.",
};

function syntheticPrediction(lambda = { home: 1.75, away: 0.95 }, reasons: Record<string, string> = REASONS): PredictionSet {
  const p = matchProbabilities(lambda);
  const scenarios = scenariosFrom(p).map((scenario) => ({ ...scenario, reason: reasons[scenario.id] ?? "" }));
  return { sourceId: "internal", sourceVersion: "poisson-v1", computedAtUtc: "2026-10-20T10:00:00.000Z", scenarios, ...scenarioSummary(scenarios, p) };
}

const INTL = { name: "intl", people: "intl" } as const;

const CASES = {
  "gs-kas": {
    lambda: { home: 1.75, away: 0.95 },
    reasons: REASONS,
    selection: { open: ["RESULT_1X2", "BTTS"], locked: ["HT_RESULT", "GOALS_4PLUS", "COMBO"] },
    meta: { sides: { home: "Galatasaray", away: "Kasımpaşa" }, homeTeamId: 645, awayTeamId: 3563, kickoffUtc: "2026-10-24T17:00:00Z", competitionName: "Trendyol Süper Lig", roundLabel: "9. Hafta", homeForm: ["W", "W", "D", "W", "W"], awayForm: ["L", "D", "L", "W", "L"] },
  },
  // Yabancı takımlar + UEFA; 02 göstergesi takım adı ("INTER") — denetim 2026-10-30.
  "int-bvb": {
    lambda: { home: 2.4, away: 0.7 },
    reasons: { RESULT_1X2: "Inter son 5 maçında 3 galibiyet aldı.", HT_RESULT: "Inter ilk yarıda maç başı 0,9 gol atıyor." },
    selection: { open: ["RESULT_1X2", "HT_RESULT"], locked: ["BTTS", "GOALS_4PLUS", "COMBO"] },
    meta: { sides: { home: "Inter", away: "Borussia Dortmund" }, homeTeamId: 505, awayTeamId: 165, kickoffUtc: "2026-11-04T20:00:00Z", competitionName: "UEFA Şampiyonlar Ligi", roundLabel: "Lig Aşaması · 4. Maç", homeForm: ["W", "W", "D", "W", "L"], awayForm: ["W", "L", "W", "D", "W"], origins: { home: INTL, away: INTL } },
  },
} satisfies Record<string, { lambda: { home: number; away: number }; reasons: Record<string, string>; selection: { open: string[]; locked: string[] }; meta: VitrinMeta }>;
type CaseName = keyof typeof CASES;

/**
 * Canlı test regresyonları (2026-10-31) — YENİ, baseline onay bekliyor: yerleşim kapısı koşar, çıktı
 * `__output__/vitrin-new/` altına yazılır. Trabzonspor–Gaziantep FK %64/%19/%17 ("BERABERLİK" ↔ "GAZİANTEP FK"
 * temas ediyordu, kapı geçiyordu); Borussia Mönchengladbach–SC Paderborn 07 (02 "2. açık kutu güvenli kenarı 15px
 * aşıyor" — göstergede uzun takım adı; kısa ad "M'GLADBACH").
 */
const NEW_CASES = {
  "tra-gfk": {
    lambda: { home: 1.9, away: 0.7 },
    reasons: { RESULT_1X2: "Trabzonspor son 5 maçında 4 galibiyet aldı.", BTTS: "Gaziantep FK maç başı 1,2 gol atıyor." },
    selection: { open: ["RESULT_1X2", "BTTS"], locked: ["HT_RESULT", "GOALS_4PLUS", "COMBO"] },
    meta: { sides: { home: "Trabzonspor", away: "Gaziantep FK" }, homeTeamId: 998, awayTeamId: 3573, kickoffUtc: "2026-11-01T16:00:00Z", competitionName: "Trendyol Süper Lig", roundLabel: "10. Hafta", homeForm: ["W", "W", "D", "W", "L"], awayForm: ["L", "D", "W", "L", "D"] },
    bar: { home: 64, draw: 19, away: 17 },
  },
  "bmg-scp": {
    lambda: { home: 2.8, away: 0.5 },
    reasons: { RESULT_1X2: "Borussia Mönchengladbach son 5 maçında 3 galibiyet aldı.", HT_RESULT: "Borussia Mönchengladbach ilk yarıda maç başı 0,9 gol atıyor." },
    selection: { open: ["RESULT_1X2", "HT_RESULT"], locked: ["BTTS", "GOALS_4PLUS", "COMBO"] },
    meta: { sides: { home: "Borussia Mönchengladbach", away: "SC Paderborn 07" }, homeTeamId: 163, awayTeamId: 185, kickoffUtc: "2026-10-31T16:30:00Z", competitionName: "Bundesliga", roundLabel: "9. Hafta", homeForm: ["W", "L", "W", "D", "W"], awayForm: ["L", "L", "D", "W", "L"], origins: { home: INTL, away: INTL } },
    bar: null,
  },
} satisfies Record<string, { lambda: { home: number; away: number }; reasons: Record<string, string>; selection: { open: string[]; locked: string[] }; meta: VitrinMeta; bar: { home: number; draw: number; away: number } | null }>;
const NEW_OUTPUT_DIR = path.join(ROOT, "__output__", "vitrin-new");

async function newCard(name: keyof typeof NEW_CASES) {
  const { lambda, reasons, selection, meta, bar } = NEW_CASES[name];
  const built = buildVitrinCard(syntheticPrediction(lambda, reasons), selection as never, meta, { homeLogo: null, awayLogo: null, brandLogo: await loadBrandLogo() });
  return bar ? { ...built, winBar: { ...built.winBar, ...bar } } : built;
}

async function card(name: CaseName = "gs-kas") {
  const { lambda, reasons, selection, meta } = CASES[name];
  return buildVitrinCard(syntheticPrediction(lambda, reasons), selection as never, meta, { homeLogo: null, awayLogo: null, brandLogo: await loadBrandLogo() });
}

/** [01 Poster, 02 Analiz] — iki sayfanın da yerleşim kontrolüyle. İki taraf aynı sentetik fotoğraf. */
async function render(id: MatchDayFormatId, name: CaseName = "gs-kas", given?: VitrinCard): Promise<[Buffer, Buffer]> {
  const frame = MATCH_DAY_FRAMES[id];
  const vitrin = given ?? (await card(name));
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

  for (const id of MATCH_DAY_FORMAT_IDS) {
    test(`int-bvb ${id}`, async () => {
      const [poster, analysis] = await render(id, "int-bvb");
      await compare(`int-bvb_${id}_01-poster`, poster);
      await compare(`int-bvb_${id}_02-analiz`, analysis);
    });
  }

  for (const name of Object.keys(NEW_CASES) as (keyof typeof NEW_CASES)[]) {
    for (const id of MATCH_DAY_FORMAT_IDS) {
      test(`YENİ ${name} ${id} (baseline onay bekliyor)`, async () => {
        await mkdir(NEW_OUTPUT_DIR, { recursive: true });
        const [poster, analysis] = await render(id, "gs-kas", await newCard(name));
        await writeFile(path.join(NEW_OUTPUT_DIR, `${name}_${id}_01-poster.png`), poster);
        await writeFile(path.join(NEW_OUTPUT_DIR, `${name}_${id}_02-analiz.png`), analysis);
      });
    }
  }

  test("Gladbach–Paderborn: dar alanlar kısa ad, poster uzun ad", async () => {
    const vitrin = await newCard("bmg-scp");
    assert.equal(vitrin.homeTeam, "BORUSSIA MÖNCHENGLADBACH");
    assert.deepEqual(vitrin.shortTeams, { home: "M'GLADBACH", away: "PADERBORN", plain: { home: "M'gladbach", away: "Paderborn" } });
    assert.equal(vitrin.open[1].lines.find((line) => line.picked)?.upperLabel, "M'GLADBACH");
  });

  test("yabancı ad: kart köken kuralıyla, gönderi metni büyütülmemiş kart adıyla", async () => {
    const vitrin = await card("int-bvb");
    assert.deepEqual([vitrin.homeTeam, vitrin.awayTeam, vitrin.competitionLabel], ["INTER", "BORUSSIA DORTMUND", "UEFA ŞAMPİYONLAR LİGİ"]);
    assert.equal(vitrin.open[1].lines.find((line) => line.picked)?.upperLabel, "INTER");
    const caption = buildVitrinCaption(vitrin);
    assert.ok(caption.startsWith("Inter – Borussia Dortmund | Maç önü analiz\nUEFA Şampiyonlar Ligi · Lig Aşaması · 4. Maç"), caption);
    assert.ok(!/Borussıa|Uefa|İnter/u.test(caption));
  });

  test("aynı kart iki kez çizilince birebir aynı (tohumlu gren)", async () => {
    const [first, second] = [await render("IG_PORTRAIT"), await render("IG_PORTRAIT")];
    assert.ok(first[0].equals(second[0]) && first[1].equals(second[1]));
  });
});
