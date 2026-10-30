/**
 * Tahmin Karnesi offline render — DB'ye dokunmaz, deploy'suz tasarım aracı. Maçın GERÇEK skoru
 * API-Football'dan okunur (yalnızca okuma, tek istek + gerekirse günün fikstür listesi); tahmin kayıtları
 * SENTETİKTİR (prod'da PredictionRecord yok): Vitrin onayının yazacağı gibi 2 açık kutu, gerçek skorla
 * değerlendirilir. B (dönem) kayıtları da sentetik: 7 kayıt (küçük örneklem) ve 24 kayıt (isabet oranı +
 * model sürümü ayrımı). Kartta "sentetik" yazmaz; dosya adında SENTETIK var. Fal / Anthropic yok.
 * Maç bitmediyse (FT/AET/PEN değil) çizmez, durumu yazıp 2 koduyla çıkar.
 * Çıktılar `--out` klasörüne (repo dışı).
 *
 *   npx tsx --env-file=.env.local scripts/render-prediction-scorecard.ts --out C:\...\son-kartlar [--fixture api-football-123] [--date 2026-10-30] [--home Konyaspor] [--away Galatasaray]
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { loadBrandLogo } from "@/lib/dashboard/match-day-assets";
import { MATCH_DAY_FRAMES } from "@/lib/dashboard/match-day-formats";
import { buildMatchScorecardCaption, buildPeriodScorecardCaption } from "@/lib/dashboard/prediction-scorecard-caption";
import { buildMatchScorecardCard, buildPeriodScorecardCard } from "@/lib/dashboard/prediction-scorecard-card";
import { renderScorecardImage } from "@/lib/dashboard/prediction-scorecard-render";
import { buildMatchScorecard, buildPeriodScorecard } from "@/lib/prediction/scorecard";
import { periodFor } from "@/lib/prediction/scorecard-period";
import { settleOutcome } from "@/lib/prediction/settle";
import { getFixturesForDateRange, parseFixtureId } from "@/lib/services/api-football";
import { getScorecardMatch } from "@/lib/services/api-football/fixture-score";
import type { ScenarioOutcome } from "@/types/prediction";
import type { ScorecardCard } from "@/types/prediction-scorecard-card";
import type { ScorecardEntry, ScorecardMatch, ScorecardRecord } from "@/types/prediction-scorecard";

const { values } = parseArgs({
  options: {
    out: { type: "string" },
    fixture: { type: "string" },
    date: { type: "string", default: "2026-10-30" },
    home: { type: "string", default: "Konya" },
    away: { type: "string", default: "Galatasaray" },
  },
});

const fold = (text: string) => text.toLocaleLowerCase("tr-TR").normalize("NFD").replace(/\p{M}/gu, "");

async function findFixture(): Promise<number> {
  const given = values.fixture ? parseFixtureId(values.fixture) ?? Number(values.fixture) : null;
  if (given) return given;
  const day = await getFixturesForDateRange({ from: values.date, to: values.date });
  if (!day.ok) throw new Error(`Fikstür alınamadı: ${day.error.message}`);
  const match = day.data.find((fixture) => fold(fixture.homeTeam.name).includes(fold(values.home)) && fold(fixture.awayTeam.name).includes(fold(values.away)));
  const id = match ? parseFixtureId(match.id) : null;
  if (!id) throw new Error(`${values.date} günü ${values.home}–${values.away} maçı bulunamadı — --fixture verin.`);
  return id;
}

/** Vitrin onayının yazacağı gibi 2 açık kutu (varsayılan seçim: kazanma + iki takım da gol) — SENTETİK. */
function syntheticRecords(match: ScorecardMatch): ScorecardRecord[] {
  const box = (id: string, outcome: ScenarioOutcome, probability: number): ScorecardRecord => ({ id, fixtureId: match.fixtureId, scenarioId: outcome.scenario, outcome, probability, modelVersion: "v2-season-xg", recordedAt: "2026-10-30T12:00:00.000Z" });
  return [box("sentetik-1", { scenario: "RESULT_1X2", pick: "AWAY" }, 0.52), box("sentetik-2", { scenario: "BTTS", pick: "YES" }, 0.57)];
}

const OUTCOMES: ScenarioOutcome[] = [
  { scenario: "RESULT_1X2", pick: "HOME" },
  { scenario: "BTTS", pick: "YES" },
  { scenario: "GOALS_3PLUS", pick: "NO" },
  { scenario: "HT_RESULT", pick: "DRAW" },
  { scenario: "COMBO", team: "HOME", pick: "NO" },
];

/** Dönem: maçın kendi 2 kaydı (gerçek skorla değerlendirilmiş) + sentetik geçmiş kayıtlar (Ekim, H/M deseni). */
function syntheticPeriod(match: ScorecardMatch, own: ScorecardRecord[], count: number): ScorecardEntry[] {
  const evaluated: ScorecardEntry[] = own.map((record) => {
    const settled = settleOutcome(record.outcome, match.score);
    return { record, kickoffUtc: match.kickoffUtc, status: settled.kind === "PENDING" ? null : settled.status };
  });
  const pattern = "HMHHMHHMHM";
  const past = Array.from({ length: count - own.length }, (_, index): ScorecardEntry => {
    const outcome = OUTCOMES[index % OUTCOMES.length] as ScenarioOutcome;
    const day = String(2 + Math.floor(index / 2)).padStart(2, "0");
    return {
      record: { id: `sentetik-gecmis-${index}`, fixtureId: `sentetik-${Math.floor(index / 2)}`, scenarioId: outcome.scenario, outcome, probability: 0.55, modelVersion: index < (count - own.length) / 2 ? null : "v2-season-xg", recordedAt: `2026-10-${day}T08:00:00.000Z` },
      kickoffUtc: `2026-10-${day}T17:00:00.000Z`,
      status: pattern[index % pattern.length] === "H" ? "HIT" : "MISS",
    };
  });
  return [...past, ...evaluated];
}

async function render(card: ScorecardCard, file: string, seedKey: string) {
  const rendered = await renderScorecardImage({ card, frame: MATCH_DAY_FRAMES.IG_PORTRAIT, resultImage: null, seedKey });
  if (!rendered.ok) throw new Error(rendered.error.message);
  await writeFile(file, rendered.data);
  console.log(`yazıldı: ${file}`);
}

async function main() {
  if (!values.out) throw new Error("--out zorunlu (repo dışı klasör).");
  const out = values.out;
  await mkdir(out, { recursive: true });
  const id = await findFixture();
  const found = await getScorecardMatch(id);
  if (!found.ok) throw new Error(`Maç okunamadı: ${found.error.message}`);
  const match = found.data;
  if (!match) throw new Error(`Maç bulunamadı: ${id}`);
  const ft = match.score.fulltime;
  const ht = match.score.halftime;
  console.log(`maç ${match.fixtureId}: ${match.home.name}–${match.away.name} · durum ${match.score.statusShort} · normal süre ${ft ? `${ft.home}–${ft.away}` : "yok"} · ilk yarı ${ht ? `${ht.home}–${ht.away}` : "yok"}`);
  const records = syntheticRecords(match);
  const sides = { home: match.home.name, away: match.away.name };
  const built = buildMatchScorecard({ fixtureId: match.fixtureId, sides, score: match.score, records });
  if (!built.ok) {
    console.log(`A üretilmedi: ${built.error.message}`);
    process.exitCode = built.error.code === "NOT_SETTLED" ? 2 : 1;
    return;
  }
  const brandLogo = await loadBrandLogo();
  const slug = `${fold(match.home.name)}-${fold(match.away.name)}`.replace(/[^a-z0-9-]+/gu, "-");
  await render(buildMatchScorecardCard({ match, data: built.data, brandLogo }), path.join(out, `tahmin-karnesi-A-${slug}-SENTETIK-4x5.png`), match.fixtureId);
  console.log(`\n--- A gönderi metni ---\n${buildMatchScorecardCaption(match, built.data)}\n`);
  const period = periodFor("MONTH", new Date(match.kickoffUtc));
  for (const count of [7, 24]) {
    const data = buildPeriodScorecard({ period, entries: syntheticPeriod(match, records, count), splitByModelVersion: true });
    if (!data.ok) throw new Error(data.error.message);
    await render(buildPeriodScorecardCard({ data: data.data, brandLogo }), path.join(out, `tahmin-karnesi-B-aylik-${count}-kayit-SENTETIK-4x5.png`), `karne-${period.start}-${count}`);
    console.log(`\n--- B (${count}) gönderi metni ---\n${buildPeriodScorecardCaption(data.data)}\n`);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
