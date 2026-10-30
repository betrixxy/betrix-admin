import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, test } from "node:test";
import { buildHalvesCard, buildTimelineCard, type AnalysisImages } from "@/lib/dashboard/match-analysis-card";
import { renderHalvesImage, renderHalvesOverlay, renderTimelineImage, renderTimelineOverlay } from "@/lib/dashboard/match-analysis-render";
import { checkLayout, describeLayoutIssues } from "@/lib/dashboard/layout-check";
import { loadBrandLogo } from "@/lib/dashboard/match-day-assets";
import { MATCH_DAY_FRAMES } from "@/lib/dashboard/match-day-formats";
import { assembleMatchAnalysisFacts } from "@/lib/match-analysis/assemble";
import { chooseHalves } from "@/lib/match-analysis/halves";
import { withEventNames } from "@/lib/match-analysis/names";
import { apiFootballHalfRows } from "@/lib/services/api-football/half-stats-mappers";
import type { ApiFootballFixtureResultRaw } from "@/lib/services/api-football/types";
import { ANALYSIS_BLOCKS } from "@/skills/render-engine/templates/match-analysis/parts";
import { MATCH_DAY_FORMAT_IDS, type MatchDayFormatId } from "@/types/match-day";
import type { HalvesOutcome, MatchAnalysisFacts } from "@/types/match-analysis";
import { KURGU_AWAY, KURGU_HOME, RAW_DENSE_MATCH, RAW_EXTRA_TIME_MATCH, RAW_RED_CARD_MATCH, syntheticHalves } from "../fixtures/api-football/match-analysis";
import { HALF_KONYASPOR_GALATASARAY, RAW_KONYASPOR_GALATASARAY } from "../fixtures/api-football/match-analysis-real";
import { fixtureTeamPeople } from "../fixtures/card-names";
import { SM_SQUAD_GALATASARAY, SM_SQUAD_KURGU } from "../fixtures/sportmonks/people";
import { MAX_DIFF_RATIO, diffPng } from "./image-diff";

/**
 * Maç Analizi görsel testi (bkz. CLAUDE.md 5.3) — 01 Zaman çizelgesi + 02 Devre devre × 4 format. Veri: gerçek
 * maç (Konyaspor 0-4 Galatasaray, olaylar + API-Football devre verisi) ve kurgusal maçlar (kalabalık maç + uzun
 * Türkçe/yabancı adlar, kırmızı kart sonrası goller + KK + VAR, uzatmalı maç). Kişi adları üretim kuralından
 * (sabit Sportmonks yanıtı → `fixtureTeamPeople` → `withEventNames`). Ağ yok: logolar `null`. Her sayfada
 * YERLEŞİM KAPISI.
 *
 * Baseline onaylı (2026-10-31; prediction-scorecard 16, match-analysis 20). Baseline dosyası yoksa yalnızca yerleşim kapısı koşar ve çıktı
 * `__output__/match-analysis/` altına yazılır; baseline varsa piksel karşılaştırması yapılır.
 *   npm run test:visual:update   # baseline'ı yazar — yalnızca kullanıcı onayıyla
 */

const ROOT = path.join(process.cwd(), "tests", "visual");
const BASELINE_DIR = path.join(ROOT, "__baseline__", "match-analysis");
const OUTPUT_DIR = path.join(ROOT, "__output__", "match-analysis");
const UPDATE = process.env.npm_lifecycle_event === "test:visual:update" || process.env.UPDATE_BASELINE === "1";

const TR = { name: "tr", people: "tr" } as const;
const NO_HALVES: HalvesOutcome = { available: false, reason: "test" };

function analysis(raw: ApiFootballFixtureResultRaw, halves: HalvesOutcome, squads: { home: unknown; away: unknown }): MatchAnalysisFacts {
  const assembled = assembleMatchAnalysisFacts(raw, halves);
  assert.ok(assembled, "bitmiş maç olmalı");
  // Türk takımları — büyük harf Türkçe ("KONYASPOR", "İ"); motorda `withTeamOrigins` doldurur.
  const match = { ...assembled.match, home: { ...assembled.match.home, origin: TR }, away: { ...assembled.match.away, origin: TR } };
  return withEventNames({ ...assembled, match }, { home: fixtureTeamPeople({ sportmonks: squads.home, hint: "tr" }), away: fixtureTeamPeople({ sportmonks: squads.away, hint: "tr" }) });
}

const KONYA_GS = analysis(RAW_KONYASPOR_GALATASARAY, chooseHalves(apiFootballHalfRows(HALF_KONYASPOR_GALATASARAY, { home: 607, away: 645 }), null, false), { home: SM_SQUAD_KURGU, away: SM_SQUAD_GALATASARAY });
const KURGU_IDS = { home: KURGU_HOME.id, away: KURGU_AWAY.id };
const DENSE = analysis(
  RAW_DENSE_MATCH,
  chooseHalves(apiFootballHalfRows(syntheticHalves(KURGU_IDS, { possession: [58, 42, 39, 61], shots: [9, 3, 2, 11], onTarget: [4, 1, 0, 5], xg: ["1.42", "0.31", "0.12", "1.88"], corners: [5, 1, 0, 7] }), KURGU_IDS), null, false),
  { home: SM_SQUAD_KURGU, away: SM_SQUAD_KURGU },
);
const RED = analysis(RAW_RED_CARD_MATCH, NO_HALVES, { home: SM_SQUAD_KURGU, away: SM_SQUAD_KURGU });
const EXTRA = analysis(RAW_EXTRA_TIME_MATCH, NO_HALVES, { home: SM_SQUAD_KURGU, away: SM_SQUAD_KURGU });

async function images(): Promise<AnalysisImages> {
  return { homeLogo: null, awayLogo: null, brandLogo: await loadBrandLogo() };
}

async function timeline(id: MatchDayFormatId, facts: MatchAnalysisFacts, label: string) {
  const frame = MATCH_DAY_FRAMES[id];
  const card = buildTimelineCard(facts, frame, await images());
  const { issues } = await checkLayout(frame, (only) => renderTimelineOverlay(card, frame, only), ANALYSIS_BLOCKS);
  assert.equal(issues.length, 0, `${label} 01 ${id}: yerleşim çakışması — ${describeLayoutIssues(issues)}`);
  const rendered = await renderTimelineImage({ card, frame, resultImage: null, seedKey: facts.match.fixtureId });
  assert.ok(rendered.ok, rendered.ok ? "" : rendered.error.message);
  return rendered.data;
}

async function halves(id: MatchDayFormatId, facts: MatchAnalysisFacts, label: string) {
  const frame = MATCH_DAY_FRAMES[id];
  assert.ok(facts.halves.available, `${label}: devre verisi olmalı`);
  const card = buildHalvesCard(facts, facts.halves.stats, await images());
  const { issues } = await checkLayout(frame, (only) => renderHalvesOverlay(card, frame, only), ANALYSIS_BLOCKS);
  assert.equal(issues.length, 0, `${label} 02 ${id}: yerleşim çakışması — ${describeLayoutIssues(issues)}`);
  const rendered = await renderHalvesImage({ card, frame, resultImage: null, seedKey: facts.match.fixtureId });
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
  assert.ok(result.diffRatio <= MAX_DIFF_RATIO, `${file}: piksellerin %${(result.diffRatio * 100).toFixed(2)}'si farklı — bkz. tests/visual/__output__/match-analysis/`);
}

describe("Maç Analizi (01 + 02) — görsel + yerleşim", async () => {
  await rm(OUTPUT_DIR, { recursive: true, force: true });
  await mkdir(UPDATE ? BASELINE_DIR : OUTPUT_DIR, { recursive: true });

  for (const id of MATCH_DAY_FORMAT_IDS) {
    test(`Konyaspor–Galatasaray + kalabalık maç, 01 + 02 — ${id}`, async () => {
      await compare(`01-konya-gs_${id}`, await timeline(id, KONYA_GS, "Konyaspor–Galatasaray"));
      await compare(`02-konya-gs_${id}`, await halves(id, KONYA_GS, "Konyaspor–Galatasaray"));
      await compare(`01-dense_${id}`, await timeline(id, DENSE, "kalabalık maç"));
      await compare(`02-dense_${id}`, await halves(id, DENSE, "kalabalık maç"));
    });
  }

  test("kırmızı kart sonrası + KK + VAR, uzatmalı maç — 4:5 ve 16:9", async () => {
    for (const id of ["IG_PORTRAIT", "X_LANDSCAPE"] as const) {
      await compare(`01-red_${id}`, await timeline(id, RED, "kırmızı kart maçı"));
      await compare(`01-extra-time_${id}`, await timeline(id, EXTRA, "uzatmalı maç"));
    }
  });

  test("aynı kart iki kez çizilince birebir aynı (tohumlu gren)", async () => {
    const [first, second] = [await timeline("IG_PORTRAIT", KONYA_GS, "tekrar"), await timeline("IG_PORTRAIT", KONYA_GS, "tekrar")];
    assert.ok(first.equals(second));
  });
});
