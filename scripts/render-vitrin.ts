/**
 * Maç önü vitrin kartı offline render — DB'ye yazmaz, deploy'suz tasarım aracı. Maç verisi
 * API-Football'dan okunur (yalnızca okuma); tahmin iç modelden, gerekçeler KURAL TABANLI (AI çağrısı
 * yok). `--ai` verilirse Çelik Kasa analisti tek çağrıyla yazar (ücretli — yalnızca onayla).
 * Fotoğraf: `--photo <yol>` (repo dışında; telifli fotoğraflar git'e girmez) ya da sentetik. Fal yok.
 * Çıktılar `--out` klasörüne (scratchpad önerilir, repoya YAZMAYIN).
 *
 *   npx tsx --env-file=.env --env-file=.env.local scripts/render-vitrin.ts --out C:\...\scratchpad\vitrin [--fixture api-football-123] [--formats IG_PORTRAIT|all] [--photo C:\...\foto.jpg]
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { getSelectableFixtures } from "@/lib/dashboard/fixtures";
import { inspectImageBytes } from "@/lib/dashboard/studio-images";
import { predictWithRuleReasons, renderVitrin, vitrinImages, vitrinMeta } from "@/lib/dashboard/vitrin-engine";
import { buildVitrinCaption } from "@/lib/dashboard/vitrin-caption";
import { buildVitrinCard } from "@/lib/dashboard/vitrin-card";
import { auditReasons, matchSides, vitrinFacts } from "@/lib/prediction/reasons";
import { getDeepAnalysisStats, parseFixtureId } from "@/lib/services/api-football";
import { MATCH_DAY_FORMAT_IDS, type MatchDayFormatId } from "@/types/match-day";
import type { ScenarioId } from "@/types/prediction";
import type { VitrinSelection } from "@/types/vitrin";
import { syntheticPhoto } from "../tests/visual/synthetic-photo";

const { values } = parseArgs({
  options: {
    out: { type: "string" },
    fixture: { type: "string" },
    formats: { type: "string", default: "IG_PORTRAIT" },
    photo: { type: "string" },
    ai: { type: "boolean", default: false },
  },
});

const SELECTION: VitrinSelection = { open: ["RESULT_1X2", "BTTS"], locked: ["HT_RESULT", "GOALS_4PLUS", "COMBO"] };

/** Verilmediyse önümüzdeki ilk Trendyol Süper Lig maçı. */
async function pickFixture(): Promise<string> {
  if (values.fixture) return values.fixture;
  const fixtures = await getSelectableFixtures();
  if (!fixtures.ok) throw new Error(`Fikstür alınamadı: ${fixtures.error.message}`);
  const next = fixtures.data.find((fixture) => fixture.competition.id === "super-lig" && new Date(fixture.kickoffUtc).getTime() > Date.now());
  if (!next) throw new Error("Önümüzdeki 7 günde Süper Lig maçı yok — --fixture verin.");
  return next.id;
}

async function main() {
  if (!values.out) throw new Error("--out klasörü gerekli (repo dışında).");
  const outDir = path.resolve(values.out);
  await mkdir(outDir, { recursive: true });

  const fixtureId = await pickFixture();
  const apiId = parseFixtureId(fixtureId);
  if (apiId === null) throw new Error(`Geçersiz maç kimliği: ${fixtureId}`);
  const stats = await getDeepAnalysisStats(apiId);
  if (!stats.ok) throw new Error(`Maç verisi alınamadı: ${stats.error.message}`);

  const predicted = await predictWithRuleReasons(stats.data);
  if (!predicted.ok) throw new Error(predicted.error.message);
  let prediction = predicted.data;
  if (values.ai) {
    const { generateScenarioReasons } = await import("@/lib/services/anthropic/scenario-reasons");
    const written = await generateScenarioReasons(vitrinFacts(stats.data), prediction.scenarios.map((s) => ({ kimlik: s.id, secili: s.outcome })));
    if (!written.ok) throw new Error(`AI analist: ${written.error.message}`);
    prediction = { ...prediction, scenarios: prediction.scenarios.map((s) => ({ ...s, reason: written.data[s.id as ScenarioId] })) };
  }
  const audits = auditReasons(prediction.scenarios, vitrinFacts(stats.data), matchSides(stats.data));

  const bytes = values.photo ? await readFile(values.photo) : await syntheticPhoto();
  const image = await inspectImageBytes(bytes, values.photo ? path.basename(values.photo) : "sentetik");
  if (!image.ok) throw new Error(image.error.message);

  const formats = values.formats === "all" ? [...MATCH_DAY_FORMAT_IDS] : (values.formats.split(",") as MatchDayFormatId[]);
  const files: string[] = [];
  for (const format of formats) {
    const rendered = await renderVitrin({ stats: stats.data, prediction, selection: SELECTION, format, image: image.data });
    if (!rendered.ok) {
      console.log(`${format}: KART ÜRETİLMEDİ — ${rendered.error.message}`);
      continue;
    }
    const file = path.join(outDir, `vitrin-${apiId}-${format}.png`);
    await writeFile(file, rendered.data.png);
    files.push(file);
  }

  const meta = vitrinMeta(stats.data);
  const card = buildVitrinCard(prediction, SELECTION, meta, await vitrinImages(stats.data));
  const report = {
    fixtureId,
    match: `${meta.sides.home} – ${meta.sides.away}`,
    competition: `${meta.competitionName} · ${meta.roundLabel}`,
    kickoffUtc: meta.kickoffUtc,
    source: `${prediction.sourceId} ${prediction.sourceVersion}`,
    scenarioCount: prediction.scenarioCount,
    surprisePct: prediction.surprisePct,
    scenarios: prediction.scenarios.map((s) => ({ id: s.id, outcome: s.outcome, probability: Number(s.probability.toFixed(4)), reason: s.reason, audit: audits[s.id] })),
    caption: buildVitrinCaption(card),
    reasons: values.ai ? "AI analist (Çelik Kasa)" : "kural tabanlı (AI çağrısı yok)",
    photo: values.photo ? "verilen dosya (repo dışında)" : "sentetik",
    files,
  };
  await writeFile(path.join(outDir, `report-${apiId}.json`), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
