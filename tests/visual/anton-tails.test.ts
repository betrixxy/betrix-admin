import assert from "node:assert/strict";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, test } from "node:test";
import { buildDrawCard } from "@/lib/dashboard/draw-card";
import { drawPages, renderDrawImages, renderDrawLayer } from "@/lib/dashboard/draw-render";
import { checkLayout, describeLayoutIssues } from "@/lib/dashboard/layout-check";
import { loadBrandLogo } from "@/lib/dashboard/match-day-assets";
import { MATCH_DAY_FRAMES } from "@/lib/dashboard/match-day-formats";
import { matchDayLayoutGate, renderMatchDayOverlay } from "@/lib/dashboard/match-day-overlay";
import { buildMatchResultCard } from "@/lib/dashboard/match-result-card";
import { renderMatchResultOverlay } from "@/lib/dashboard/match-result-overlay";
import { buildMatchStatsCard } from "@/lib/dashboard/match-stats-card";
import { renderMatchStatsOverlay } from "@/lib/dashboard/match-stats-overlay";
import { inspectImageBytes } from "@/lib/dashboard/studio-images";
import { buildVitrinCard } from "@/lib/dashboard/vitrin-card";
import { ANALYSIS_BLOCKS, POSTER_BLOCKS, renderVitrinImages, renderVitrinLayer, vitrinGeometries } from "@/lib/dashboard/vitrin-render";
import { scenarioSummary, scenariosFrom } from "@/lib/prediction/internal-source";
import { matchProbabilities } from "@/lib/prediction/poisson";
import { toMatchResultFacts } from "@/lib/services/api-football/match-result-mappers";
import { toMatchStatsFacts } from "@/lib/services/api-football/post-match-stats-mappers";
import type { ApiFootballFixtureResultRaw } from "@/lib/services/api-football/types";
import { SET_PAGE_LABELS } from "@/types/checkmatch-set";
import type { DrawState, DrawTeam } from "@/types/draw";
import { MATCH_DAY_FORMAT_IDS, MATCH_DAY_TEMPLATE_IDS, type MatchDayFormatId } from "@/types/match-day";
import { MATCH_RESULT_TEMPLATE_IDS } from "@/types/match-result";
import { RAW_GENCLERBIRLIGI_GALATASARAY } from "../fixtures/api-football/match-result";
import { MATCH_DAY_SCENARIOS } from "../fixtures/match-day/cards";
import { syntheticPhoto } from "./synthetic-photo";

/**
 * Anton kuyruk/nokta regresyonu (2026-10-27): Ç/Ş/Ğ kuyruğu satır kutusunun ≈ 0,23 em altına, İ noktası
 * ≈ 0,13 em üstüne taşar. Büyük Anton başlığın altında satır olan bütün kartlar FENERBAHÇE, BEŞİKTAŞ,
 * GAZİANTEP FK, ÇAYKUR RİZESPOR adlarıyla çizilir ve mürekkep düzeyindeki yerleşim kapısından geçer
 * (Kura, Vitrin, Maç Sonucu ×3 şablon, İstatistik — 4 format). Maç Günü'nün yerleşim kapısı yok: çıktısı
 * gözle inceleme için yazılır. Baseline yok (piksel karşılaştırması diğer testlerde); çıktılar
 * `__output__/anton-tails/` altında (sentetik fotoğraf).
 */

const OUTPUT_DIR = path.join(process.cwd(), "tests", "visual", "__output__", "anton-tails");
const PAIRS = [
  { key: "fb-bjk", home: { id: 611, api: "Fenerbahce", tr: "Fenerbahçe" }, away: { id: 549, api: "Besiktas", tr: "Beşiktaş" } },
  { key: "gfk-riz", home: { id: 3573, api: "Gaziantep FK", tr: "Gaziantep FK" }, away: { id: 1007, api: "Rizespor", tr: "Çaykur Rizespor" } },
] as const;

async function gate(label: string, frame: (typeof MATCH_DAY_FRAMES)[MatchDayFormatId], render: Parameters<typeof checkLayout>[1], blocks?: Parameters<typeof checkLayout>[2]) {
  const { issues } = await checkLayout(frame, render, blocks);
  assert.equal(issues.length, 0, `${label}: ${describeLayoutIssues(issues)}`);
}

const save = (file: string, png: Buffer) => writeFile(path.join(OUTPUT_DIR, `${file}.png`), png);

// ---- Maç Sonucu + İstatistik: Gençlerbirliği–Galatasaray maçının adları değiştirilir ----
function renamed(pair: (typeof PAIRS)[number]): ApiFootballFixtureResultRaw {
  const raw = structuredClone(RAW_GENCLERBIRLIGI_GALATASARAY);
  raw.teams.home.name = pair.home.api;
  raw.teams.away.name = pair.away.api;
  return raw;
}

// ---- Kura: Türk takımları (iki turnuva, lig aşaması + eleme) ----
const t = (id: number, apiName: string, country: string, pot: number | null = null): DrawTeam => ({ id, apiName, country, logoUrl: null, pot });
const TEAMS = [t(611, "Fenerbahce", "Turkey", 2), t(549, "Besiktas", "Turkey", 3), t(3573, "Gaziantep FK", "Turkey", 4), t(1007, "Rizespor", "Turkey", 4), t(560, "Slavia Praha", "Czech-Republic", 3), t(550, "Shakhtar Donetsk", "Ukraine", 2), t(40, "Liverpool", "England", 1), t(530, "Atletico Madrid", "Spain", 1)];
const LEAGUE: DrawState = {
  competition: { id: 2, name: "UEFA Şampiyonlar Ligi" },
  season: 2026,
  roundLabel: "Lig Aşaması",
  stage: "LEAGUE_PHASE",
  drawDateUtc: "2026-08-27T16:00:00Z",
  teams: TEAMS,
  ties: [],
  fixtures: [
    ...[549, 3573, 1007, 560, 550, 40, 530].map((opponentId, i) => ({ teamId: 611, opponentId, venue: i % 2 ? ("AWAY" as const) : ("HOME" as const), dateUtc: null })),
    ...[611, 3573, 1007, 560, 550, 40, 530].map((opponentId, i) => ({ teamId: 549, opponentId, venue: i % 2 ? ("HOME" as const) : ("AWAY" as const), dateUtc: null })),
  ],
  nameOverrides: {},
};
const KNOCKOUT: DrawState = {
  competition: { id: 3, name: "UEFA Avrupa Ligi" },
  season: 2026,
  roundLabel: "Son 16 Turu",
  stage: "KNOCKOUT",
  drawDateUtc: "2027-02-27T12:00:00Z",
  teams: TEAMS,
  ties: [
    { first: 1007, second: 611, firstLegUtc: "2027-03-12T20:00:00Z", secondLegUtc: "2027-03-19T20:00:00Z" },
    { first: 3573, second: 560, firstLegUtc: null, secondLegUtc: null },
    { first: 550, second: 530, firstLegUtc: null, secondLegUtc: null },
  ],
  fixtures: [],
  nameOverrides: {},
};
const DRAWS = {
  "a-lig": { variant: "TEAM", states: [LEAGUE], focusTeamId: 611 },
  "a-eleme": { variant: "TEAM", states: [KNOCKOUT], focusTeamId: 1007 },
  "b-iki-turnuva": { variant: "TURKISH", states: [LEAGUE, KNOCKOUT] },
  "c-eleme": { variant: "ALL", states: [KNOCKOUT] },
} as const;

describe("Anton kuyruk/nokta — mürekkep düzeyinde yerleşim kapısı", async () => {
  await rm(OUTPUT_DIR, { recursive: true, force: true });
  await mkdir(OUTPUT_DIR, { recursive: true });
  const brandLogo = await loadBrandLogo();
  const photo = await inspectImageBytes(await syntheticPhoto(), "sentetik");
  assert.ok(photo.ok);

  for (const id of MATCH_DAY_FORMAT_IDS) {
    const frame = MATCH_DAY_FRAMES[id];

    test(`Maç Günü DATA_DRIVEN kırılan uzun ad ${id}`, async () => {
      // "GAZİANTEP FUTBOL KULÜBÜ" tek satıra okunur boyda sığmaz → iki satır; Ç/Ş/Ğ ↔ İ/Ö/Ü kapıdan geçer.
      const base = MATCH_DAY_SCENARIOS.normal!;
      const card = { ...base, homeTeam: "GAZİANTEP FUTBOL KULÜBÜ", awayTeam: "ÇAYKUR RİZESPOR KULÜBÜ", homeTeamName: "Gaziantep Futbol Kulübü", awayTeamName: "Çaykur Rizespor Kulübü" };
      const layout = await matchDayLayoutGate(card, "DATA_DRIVEN", frame);
      assert.ok(layout.ok, layout.ok ? "" : layout.error.message);
      await save(`mac-gunu-DATA_DRIVEN-uzun-ad_${id}`, await renderMatchDayOverlay(card, "DATA_DRIVEN", frame));
    });

    test(`Kura ${id}`, async () => {
      for (const [name, input] of Object.entries(DRAWS)) {
        const built = buildDrawCard({ ...input, states: [...input.states], logos: {}, brandLogo });
        assert.ok(built.ok, built.ok ? "" : built.error.message);
        for (const [index, page] of drawPages(built.data, frame).entries()) await gate(`Kura ${name} ${id} s${index + 1}`, frame, (only) => renderDrawLayer(built.data, page.g, index, only), page.blocks);
        const pages = await renderDrawImages({ card: built.data, frame, photo: photo.data, seedKey: `anton-${name}` });
        assert.ok(pages.ok, pages.ok ? "" : pages.error.message);
        await Promise.all(pages.data.map((png, index) => save(`kura-${name}_${id}_${index + 1}`, png)));
      }
    });

    for (const pair of PAIRS) {
      test(`Maç Sonucu + İstatistik ${pair.key} ${id}`, async () => {
        const raw = renamed(pair);
        const facts = toMatchResultFacts(raw);
        const stats = toMatchStatsFacts(raw, null);
        assert.ok(facts && stats);
        assert.equal(facts.home.name, pair.home.tr);
        const images = { homeLogo: null, awayLogo: null, leagueLogo: null, brandLogo };
        const card = buildMatchResultCard(facts, images, null, SET_PAGE_LABELS.RESULT);
        for (const template of MATCH_RESULT_TEMPLATE_IDS) {
          const options = { template, shadeStrength: 1, side: "right" as const };
          await gate(`Maç Sonucu ${template} ${pair.key} ${id}`, frame, (only) => renderMatchResultOverlay(card, frame, { ...options, only }));
          await save(`mac-sonucu-${template}-${pair.key}_${id}`, await renderMatchResultOverlay(card, frame, options));
        }
        const statsCard = buildMatchStatsCard(stats, "SUMMARY", images, SET_PAGE_LABELS.STATS);
        await gate(`İstatistik ${pair.key} ${id}`, frame, (only) => renderMatchStatsOverlay(statsCard, frame, { side: "right", only }));
        await save(`istatistik-${pair.key}_${id}`, await renderMatchStatsOverlay(statsCard, frame, { side: "right" }));
      });

      test(`Vitrin ${pair.key} ${id}`, async () => {
        const p = matchProbabilities({ home: 1.6, away: 1.1 });
        const scenarios = scenariosFrom(p).map((scenario) => ({ ...scenario, reason: scenario.id === "RESULT_1X2" ? `${pair.home.tr} son 5 maçında 4 galibiyet aldı.` : `${pair.away.tr} maç başı 1,4 gol atıyor.` }));
        const prediction = { sourceId: "internal" as const, sourceVersion: "poisson-v1", computedAtUtc: "2026-10-20T10:00:00.000Z", scenarios, ...scenarioSummary(scenarios, p) };
        const vitrin = buildVitrinCard(
          prediction,
          { open: ["RESULT_1X2", "BTTS"], locked: ["HT_RESULT", "GOALS_4PLUS", "COMBO"] },
          { sides: { home: pair.home.tr, away: pair.away.tr }, homeTeamId: pair.home.id, awayTeamId: pair.away.id, kickoffUtc: "2026-10-24T17:00:00Z", competitionName: "Trendyol Süper Lig", roundLabel: "9. Hafta", homeForm: ["W", "W", "D", "W", "W"], awayForm: ["L", "D", "L", "W", "L"] },
          { homeLogo: null, awayLogo: null, brandLogo },
        );
        const { poster, analysis } = vitrinGeometries(frame);
        for (const [g, blocks] of [[poster, POSTER_BLOCKS], [analysis, ANALYSIS_BLOCKS]] as const) await gate(`Vitrin ${g.page} ${pair.key} ${id}`, frame, (only) => renderVitrinLayer(vitrin, g, only), blocks);
        const pages = await renderVitrinImages({ card: vitrin, frame, photos: { home: photo.data, away: photo.data }, seedKey: `anton-${pair.key}` });
        assert.ok(pages.ok, pages.ok ? "" : pages.error.message);
        await Promise.all(pages.data.map((png, index) => save(`vitrin-${pair.key}_${id}_${index + 1}`, png)));
      });

      test(`Maç Günü ${pair.key} ${id} (DATA_DRIVEN kapılı; diğerleri gözle)`, async () => {
        const base = MATCH_DAY_SCENARIOS.normal!;
        const card = { ...base, homeTeam: pair.home.tr.toLocaleUpperCase("tr-TR"), awayTeam: pair.away.tr.toLocaleUpperCase("tr-TR"), homeTeamName: pair.home.tr, awayTeamName: pair.away.tr };
        const layout = await matchDayLayoutGate(card, "DATA_DRIVEN", frame);
        assert.ok(layout.ok, layout.ok ? "" : layout.error.message);
        for (const template of MATCH_DAY_TEMPLATE_IDS) await save(`mac-gunu-${template}-${pair.key}_${id}`, await renderMatchDayOverlay(card, template, frame));
      });
    }
  }
});
