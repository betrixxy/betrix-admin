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
import { resultAccentHex } from "@/lib/dashboard/match-result-theme";
import { buildSpotlightCard, buildTopPlayersCard, teamHexes, type PlayerCardImages, type PlayerNames } from "@/lib/dashboard/player-stats-card";
import { renderSpotlightImage, renderSpotlightOverlay, renderTopPlayersImage, renderTopPlayersOverlay } from "@/lib/dashboard/player-stats-render";
import { assemblePlayerStatsFacts } from "@/lib/player-stats/assemble";
import { shortForm } from "@/lib/names/person-name";
import { topPlayers } from "@/lib/player-stats/picks";
import { spotlightGeometry } from "@/skills/render-engine/templates/player-stats/geometry";
import { MATCH_DAY_FORMAT_IDS, type MatchDayFormatId } from "@/types/match-day";
import type { PlayerMatchLine, PlayerStatsFacts, SpotlightCard } from "@/types/player-match-stats";
import { RAW_MILAN_BOLOGNA, SM_MILAN_BOLOGNA_IDS, SM_MILAN_BOLOGNA_LINEUP } from "../fixtures/api-football/player-match-stats";
import { MAX_DIFF_RATIO, diffPng } from "./image-diff";
import { SYNTHETIC_PHOTO_SIZE, syntheticPhoto } from "./synthetic-photo";

/**
 * Oyuncu İstatistikleri görsel testi (bkz. CLAUDE.md 5.3) — A · Maçın Oyuncusu (sentetik tam kadraj fotoğraf
 * ve tipografik yedek) + B · Maçın En İyileri (3 ve 5) × 4 format; kaleci A, uzun ad, Türkçe karakterli ad.
 * Ad kuralı: Mbangula eşleşmesiz → yalnızca "MBANGULA"; uzun/Türkçe ad güvenilir yaygın ad → ilk ad + soyad.
 * Veri gerçek maçtan (Milan 2-4 Bologna, API-Football + Sportmonks xG) — fotoğraf SENTETİK. Ağ yok: logolar
 * `null`, vesikalık yok (takım logosu yedeği). Her kartta YERLEŞİM KAPISI.
 *
 * Baseline henüz ONAYLANMADI: baseline dosyası yoksa yalnızca yerleşim kapısı koşar ve çıktı
 * `__output__/player-stats/` altına yazılır; baseline varsa piksel karşılaştırması yapılır.
 *   npm run test:visual:update   # baseline'ı yazar — yalnızca kullanıcı onayıyla
 */

const ROOT = path.join(process.cwd(), "tests", "visual");
const BASELINE_DIR = path.join(ROOT, "__baseline__", "player-stats");
const OUTPUT_DIR = path.join(ROOT, "__output__", "player-stats");
const UPDATE = process.env.npm_lifecycle_event === "test:visual:update" || process.env.UPDATE_BASELINE === "1";

const FACTS = (() => {
  const facts = assemblePlayerStatsFacts(RAW_MILAN_BOLOGNA, new Date("2026-10-30T12:00:00Z"), { players: SM_MILAN_BOLOGNA_LINEUP, ids: SM_MILAN_BOLOGNA_IDS });
  assert.ok(facts, "bitmiş maç olmalı");
  // İki İtalyan kulübü — büyük harf uluslararası ("MILAN", "TOMORI"); motorda `withTeamOrigins` doldurur.
  return { ...facts, match: { ...facts.match, home: { ...facts.match.home, origin: { name: "intl", people: "intl" } }, away: { ...facts.match.away, origin: { name: "intl", people: "intl" } } } } satisfies PlayerStatsFacts;
})();

const lineOf = (id: number): PlayerMatchLine => {
  const found = FACTS.lines.find((line) => line.playerId === id);
  assert.ok(found);
  return found;
};

/** Kurgusal kaleci (tam veri) — kaleci satırları; yenilen gol 0, penaltı kurtarışı. */
const KEEPER: PlayerMatchLine = { ...lineOf(2998), rating: 8.1, numbers: { ...lineOf(2998).numbers, saves: 7, conceded: 0, penaltySaved: 1, passesTotal: 31, passesAccurate: 24 } };
/** Kurgusal uzun ad ve Türkçe karakterli ad (veri gerçek oyuncudan). */
const LONG_NAME: PlayerMatchLine = { ...lineOf(44814), name: "Mohamed-Ali Abdelrahman Kouyaté-Diakhaby" };
const TURKISH_NAME: PlayerMatchLine = { ...lineOf(31273), name: "İrfan Can Eğribayat Çağlayan" };
/** Güvenilir yaygın ad (Sportmonks / admin düzeltmesi gibi) → poster ilk ad küçük + soyad büyük; verilmezse yalnızca API soyadı. */
const reliable = (line: PlayerMatchLine, origin: "tr" | "intl"): PlayerNames => new Map([[line.playerId, { name: line.name, short: shortForm(line.name), origin, reliable: true }]]);

const PHOTO = syntheticPhoto();

async function images(): Promise<PlayerCardImages> {
  return { homeLogo: null, awayLogo: null, brandLogo: await loadBrandLogo() };
}

async function assertLayout(label: string, frame: MatchDayFrame, render: Parameters<typeof checkLayout>[1]) {
  const { issues } = await checkLayout(frame, render);
  assert.equal(issues.length, 0, `${label}: yerleşim çakışması — ${describeLayoutIssues(issues)}`);
}

async function photoArt(frame: MatchDayFrame, card: SpotlightCard) {
  const g = spotlightGeometry(frame, card, "right").photo;
  const crop = planCrop({ source: SYNTHETIC_PHOTO_SIZE, frame, safe: g.photoSafe, faces: [], saliency: null });
  const art = await cropAndGrade(await PHOTO, crop.box, frame, resultAccentHex(FACTS.match), undefined);
  return { art, shadeStrength: shadeStrengthFor(await textRegionLuminance(art, g)) };
}

async function spotlight(id: MatchDayFormatId, line: PlayerMatchLine, typographic: boolean, pageLabel: string | null = "03 · MAÇIN OYUNCUSU", names?: PlayerNames) {
  const frame = MATCH_DAY_FRAMES[id];
  const card = buildSpotlightCard({ facts: FACTS, line, images: await images(), names, pageLabel, typographic });
  const { art, shadeStrength } = typographic ? { art: null, shadeStrength: 0 } : await photoArt(frame, card);
  await assertLayout(`A ${line.name} ${id} ${typographic ? "tipografik" : "foto"}`, frame, (only) => renderSpotlightOverlay(card, frame, { side: "right", shadeStrength, only }));
  const rendered = await renderSpotlightImage({ card, frame, art, shadeStrength, side: "right", seedKey: `player-${line.playerId}` });
  assert.ok(rendered.ok, rendered.ok ? "" : rendered.error.message);
  return rendered.data;
}

async function top(id: MatchDayFormatId, count: 3 | 5) {
  const frame = MATCH_DAY_FRAMES[id];
  const card = buildTopPlayersCard({ facts: FACTS, lines: topPlayers(FACTS.lines, count), images: await images(), pageLabel: null });
  await assertLayout(`B${count} ${id}`, frame, (only) => renderTopPlayersOverlay(card, frame, { only }));
  const hex = teamHexes(FACTS.match);
  const rendered = await renderTopPlayersImage({ card, frame, resultImage: null, teamHexes: [hex.HOME, hex.AWAY], seedKey: `top-${count}` });
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
  assert.ok(result.diffRatio <= MAX_DIFF_RATIO, `${file}: piksellerin %${(result.diffRatio * 100).toFixed(2)}'si farklı — bkz. tests/visual/__output__/player-stats/`);
}

describe("Oyuncu İstatistikleri (A + B) — görsel + yerleşim", async () => {
  await rm(OUTPUT_DIR, { recursive: true, force: true });
  await mkdir(UPDATE ? BASELINE_DIR : OUTPUT_DIR, { recursive: true });
  const mbangula = lineOf(346866);

  for (const id of MATCH_DAY_FORMAT_IDS) {
    test(`A foto + tipografik, B 3 + 5 — ${id}`, async () => {
      await compare(`A-photo_${id}`, await spotlight(id, mbangula, false));
      await compare(`A-typographic_${id}`, await spotlight(id, mbangula, true));
      await compare(`B3_${id}`, await top(id, 3));
      await compare(`B5_${id}`, await top(id, 5));
    });
  }

  test("kaleci A, uzun ad, Türkçe karakterli ad — 4:5 ve 9:16", async () => {
    for (const id of ["IG_PORTRAIT", "STORY", "X_LANDSCAPE"] as const) {
      await compare(`A-keeper_${id}`, await spotlight(id, KEEPER, false));
      await compare(`A-long-name_${id}`, await spotlight(id, LONG_NAME, true, undefined, reliable(LONG_NAME, "intl")));
      await compare(`A-turkish-name_${id}`, await spotlight(id, TURKISH_NAME, false, null, reliable(TURKISH_NAME, "tr")));
    }
  });

  test("aynı kart iki kez çizilince birebir aynı (tohumlu gren)", async () => {
    const [first, second] = [await spotlight("IG_PORTRAIT", mbangula, true), await spotlight("IG_PORTRAIT", mbangula, true)];
    assert.ok(first.equals(second));
  });
});
