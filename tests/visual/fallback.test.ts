import assert from "node:assert/strict";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, test } from "node:test";
import sharp from "sharp";
import { checkLayout, describeLayoutIssues } from "@/lib/dashboard/layout-check";
import { renderLineupCard } from "@/lib/dashboard/lineup-render";
import { loadBrandLogo } from "@/lib/dashboard/match-day-assets";
import { buildProgrammaticBackground, composeMatchDayArt, finalizeMatchDayImage } from "@/lib/dashboard/match-day-compose";
import { MATCH_DAY_FRAMES } from "@/lib/dashboard/match-day-formats";
import { matchDayLayoutGate, renderMatchDayOverlay } from "@/lib/dashboard/match-day-overlay";
import { prepareResultArt } from "@/lib/dashboard/match-result-art";
import { buildMatchResultCard } from "@/lib/dashboard/match-result-card";
import { renderMatchResultOverlay } from "@/lib/dashboard/match-result-overlay";
import { resultAccentHex } from "@/lib/dashboard/match-result-theme";
import { buildH2HCard } from "@/lib/dashboard/player-h2h-card";
import { renderH2HImages } from "@/lib/dashboard/player-h2h-render";
import { finalizeSetImage } from "@/lib/dashboard/set-finish";
import { buildVitrinCard } from "@/lib/dashboard/vitrin-card";
import { renderVitrinPages } from "@/lib/dashboard/vitrin-render";
import { scenarioSummary, scenariosFrom } from "@/lib/prediction/internal-source";
import { matchProbabilities } from "@/lib/prediction/poisson";
import { toMatchResultFacts } from "@/lib/services/api-football/match-result-mappers";
import { SET_PAGE_LABELS } from "@/types/checkmatch-set";
import { MATCH_DAY_FORMAT_IDS, MATCH_DAY_TEMPLATE_IDS } from "@/types/match-day";
import { MATCH_RESULT_TEMPLATE_IDS } from "@/types/match-result";
import type { PredictionSet } from "@/types/prediction";
import { SOCIAL_FORMAT_IDS } from "@/types/studio-formats";
import { RAW_GENCLERBIRLIGI_GALATASARAY } from "../fixtures/api-football/match-result";
import { MATCH_DAY_SCENARIOS } from "../fixtures/match-day/cards";
import { H2H_LEFT, H2H_RIGHT } from "../fixtures/player-h2h";
import { LINEUP_CASES } from "../fixtures/studio-cards";

/**
 * FOTOĞRAFSIZ / TEK FOTOĞRAFLI üretim (dayanıklılık, canlı test 2026-10-31) — YENİ görsel vakalar, BASELINE YOK:
 * çıktılar `__output__/fallback/`'a yazılır (gözle inceleme), her kartta üretimdeki yerleşim kapısı koşar.
 *   - Maç Günü: 3 şablon × 4 format × (fotoğrafsız | tek fotoğraf — deplasman yedek tasarım); programatik zemin.
 *   - Maç Sonucu A/B/C × 4 format fotoğrafsız (kazanan takımın yedek tasarımı).
 *   - Vitrin 01 + 02, Oyuncu Karşılaştırması 01 + 02, Kahraman Liste: fotoğrafsız × 4 format.
 * Logolar, oyuncu kesimi SENTETİK (telifli görsel yok); ağ, Fal ve AI yok.
 */

const OUTPUT_DIR = path.join(process.cwd(), "tests", "visual", "__output__", "fallback");
const save = (file: string, png: Buffer) => writeFile(path.join(OUTPUT_DIR, `${file}.png`), png);

/** Sentetik arma (şeffaf zeminli kalkan) — `data:` URI. */
async function syntheticLogo(primary: string, secondary: string, letter: string): Promise<string> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300">
    <path d="M150 12 L270 52 L258 170 Q240 250 150 290 Q60 250 42 170 L30 52 Z" fill="${primary}" stroke="${secondary}" stroke-width="14"/>
    <rect x="120" y="40" width="60" height="230" fill="${secondary}" opacity="0.9"/>
    <circle cx="150" cy="140" r="58" fill="${primary}" stroke="${secondary}" stroke-width="10"/>
    <text x="150" y="165" font-family="Arial" font-weight="bold" font-size="72" text-anchor="middle" fill="${secondary}">${letter}</text>
  </svg>`;
  return `data:image/png;base64,${(await sharp(Buffer.from(svg)).png().toBuffer()).toString("base64")}`;
}

/** Sentetik oyuncu kesimi (şeffaf zeminli siluet). */
async function syntheticCutout(hex: string): Promise<Buffer> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="1100"><rect x="140" y="300" width="320" height="800" rx="120" fill="${hex}"/><circle cx="300" cy="190" r="120" fill="#d9a77f"/></svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

const LOGOS = {
  home: syntheticLogo("#FDB912", "#A90432", "G"),
  away: syntheticLogo("#E30613", "#FFFFFF", "K"),
};

async function gate(label: string, frame: Parameters<typeof checkLayout>[0], render: Parameters<typeof checkLayout>[1], blocks?: Parameters<typeof checkLayout>[2]) {
  const { issues } = await checkLayout(frame, render, blocks);
  assert.equal(issues.length, 0, `${label}: yerleşim çakışması — ${describeLayoutIssues(issues)}`);
}

describe("Fotoğrafsız / tek fotoğraflı yedek tasarım (baseline yok, __output__/fallback)", async () => {
  await rm(OUTPUT_DIR, { recursive: true, force: true });
  await mkdir(OUTPUT_DIR, { recursive: true });

  for (const template of MATCH_DAY_TEMPLATE_IDS) {
    for (const format of MATCH_DAY_FORMAT_IDS) {
      for (const variant of ["fotografsiz", "tek-fotograf"] as const) {
        test(`Maç Günü ${template} ${format} ${variant}`, async () => {
          const frame = MATCH_DAY_FRAMES[format];
          const base = MATCH_DAY_SCENARIOS.normal!;
          const card = { ...base, homeLogo: await LOGOS.home, awayLogo: await LOGOS.away };
          const layout = await matchDayLayoutGate(card, template, frame);
          assert.ok(layout.ok, layout.ok ? "" : layout.error.message);
          const home = { bytes: variant === "tek-fotograf" ? await syntheticCutout(card.homeColorHex) : null, colorHex: card.homeColorHex, team: { name: card.homeTeam, hex: card.homeColorHex, logo: card.homeLogo } };
          const away = { bytes: null, colorHex: card.awayColorHex, team: { name: card.awayTeam, hex: card.awayColorHex, logo: card.awayLogo } };
          const art = await composeMatchDayArt(await buildProgrammaticBackground(frame, card.homeColorHex), { template, frame }, home, away);
          await save(`mac-gunu_${template}_${format}_${variant}`, await finalizeMatchDayImage(art, await renderMatchDayOverlay(card, template, frame), frame));
        });
      }
    }
  }

  for (const template of MATCH_RESULT_TEMPLATE_IDS) {
    for (const format of MATCH_DAY_FORMAT_IDS) {
      test(`Maç Sonucu ${template} ${format} fotoğrafsız`, async () => {
        const frame = MATCH_DAY_FRAMES[format];
        const facts = toMatchResultFacts(RAW_GENCLERBIRLIGI_GALATASARAY);
        assert.ok(facts);
        const accentHex = resultAccentHex(facts);
        const winnerLogo = facts.outcome === "AWAY" ? await LOGOS.home : await LOGOS.away;
        const prepared = await prepareResultArt({ facts, frame, template, accentHex, photo: null, logo: winnerLogo });
        assert.ok(prepared.ok);
        const card = buildMatchResultCard(facts, { homeLogo: await LOGOS.away, awayLogo: await LOGOS.home, leagueLogo: null, brandLogo: await loadBrandLogo() }, null, SET_PAGE_LABELS.RESULT);
        const options = { template, shadeStrength: prepared.data.shadeStrength, side: prepared.data.side };
        await gate(`Maç Sonucu ${template} ${format}`, frame, (only) => renderMatchResultOverlay(card, frame, { ...options, only }));
        await save(`mac-sonucu_${template}_${format}_fotografsiz`, await finalizeSetImage(prepared.data.art, await renderMatchResultOverlay(card, frame, options), frame, facts.fixtureId));
      });
    }
  }

  for (const format of MATCH_DAY_FORMAT_IDS) {
    test(`Vitrin ${format} fotoğrafsız (iki yarı yedek tasarım)`, async () => {
      const frame = MATCH_DAY_FRAMES[format];
      const p = matchProbabilities({ home: 1.75, away: 0.95 });
      const scenarios = scenariosFrom(p).map((scenario) => ({ ...scenario, reason: scenario.id === "RESULT_1X2" ? "Galatasaray son 5 maçında 4 galibiyet aldı." : scenario.id === "BTTS" ? "Kasımpaşa maç başı 1,4 gol atıyor." : "" }));
      const prediction: PredictionSet = { sourceId: "internal", sourceVersion: "poisson-v1", computedAtUtc: "2026-10-20T10:00:00.000Z", scenarios, ...scenarioSummary(scenarios, p) };
      const meta = { sides: { home: "Galatasaray", away: "Kasımpaşa" }, homeTeamId: 645, awayTeamId: 3563, kickoffUtc: "2026-10-24T17:00:00Z", competitionName: "Trendyol Süper Lig", roundLabel: "9. Hafta", homeForm: ["W", "W", "D", "W", "W"], awayForm: ["L", "D", "L", "W", "L"] } as const;
      const vitrin = buildVitrinCard(prediction, { open: ["RESULT_1X2", "BTTS"], locked: ["HT_RESULT", "GOALS_4PLUS", "COMBO"] }, { ...meta, homeForm: [...meta.homeForm], awayForm: [...meta.awayForm] }, { homeLogo: await LOGOS.home, awayLogo: await LOGOS.away, brandLogo: await loadBrandLogo() });
      const result = await renderVitrinPages({ card: vitrin, frame, photos: { home: null, away: null }, seedKey: "fallback-vitrin" });
      assert.ok(result.ok, result.ok ? "" : result.error.message);
      assert.equal(result.data.pages.length, 2, result.data.notes.join(" "));
      await Promise.all(result.data.pages.map((png, index) => save(`vitrin_${format}_0${index + 1}_fotografsiz`, png)));
    });

    test(`Oyuncu Karşılaştırması ${format} fotoğrafsız + vesikalıksız`, async () => {
      const frame = MATCH_DAY_FRAMES[format];
      const built = buildH2HCard({
        left: H2H_LEFT,
        right: H2H_RIGHT,
        mode: "PER90",
        match: { homeTeam: "Fenerbahçe", awayTeam: "Borussia Mönchengladbach", kickoffUtc: "2026-11-05T17:45:00Z", homeOrigin: "tr", awayOrigin: "intl" },
        images: { leftLogo: await LOGOS.home, rightLogo: await LOGOS.away, leftFace: null, rightFace: null, brandLogo: await loadBrandLogo() },
        frame,
      });
      assert.ok(built.ok, built.ok ? "" : built.error.message);
      const pages = await renderH2HImages({ card: built.data.card, frame, photos: { home: null, away: null }, seedKey: "fallback-h2h" });
      assert.ok(pages.ok, pages.ok ? "" : pages.error.message);
      await Promise.all(pages.data.map((png, index) => save(`h2h_${format}_0${index + 1}_fotografsiz`, png)));
    });
  }

  for (const format of SOCIAL_FORMAT_IDS) {
    test(`Kahraman Liste ${format} kapaksız (yedek tasarım kapak)`, async () => {
      const base = LINEUP_CASES[Object.keys(LINEUP_CASES)[0] ?? ""];
      assert.ok(base);
      const result = await renderLineupCard({ ...base, format, templateStyle: "hero_list", team: { ...base.team, heroPhotoId: "" }, heroPhoto: null });
      assert.ok(result.ok, result.ok ? "" : result.error.message);
      assert.equal(result.data.templateStyle, "hero_list");
      await save(`kahraman-liste_${format}_kapaksiz`, result.data.png);
    });
  }
});
