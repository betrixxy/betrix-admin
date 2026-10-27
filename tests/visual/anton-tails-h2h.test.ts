import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, test } from "node:test";
import { checkLayout, describeLayoutIssues } from "@/lib/dashboard/layout-check";
import { loadBrandLogo } from "@/lib/dashboard/match-day-assets";
import { MATCH_DAY_FRAMES } from "@/lib/dashboard/match-day-formats";
import { buildH2HCard } from "@/lib/dashboard/player-h2h-card";
import { H2H_COMPARE_BLOCKS, H2H_POSTER_BLOCKS, h2hGeometries, renderH2HImages, renderH2HLayer } from "@/lib/dashboard/player-h2h-render";
import { inspectImageBytes } from "@/lib/dashboard/studio-images";
import { MATCH_DAY_FORMAT_IDS } from "@/types/match-day";
import { H2H_LEFT, H2H_RIGHT } from "../fixtures/player-h2h";
import { syntheticPhoto } from "./synthetic-photo";

/**
 * Anton kuyruk/nokta regresyonu — Oyuncu Karşılaştırması (bkz. anton-tails.test.ts). Takım adları FENERBAHÇE ·
 * BEŞİKTAŞ · GAZİANTEP FK · ÇAYKUR RİZESPOR, oyuncu adları Ç/Ş/Ğ/İ'li; iki sayfa × 4 format mürekkep kapısından.
 */

const OUTPUT_DIR = path.join(process.cwd(), "tests", "visual", "__output__", "anton-tails-h2h");
const PAIRS = [
  { key: "fb-bjk", left: { teamName: "Fenerbahçe", teamId: 611, fullName: "İrfan Can Eğribayat", shortName: "Eğribayat" }, right: { teamName: "Beşiktaş", teamId: 549, fullName: "Çağlar Söyüncü", shortName: "Söyüncü" } },
  { key: "gfk-riz", left: { teamName: "Gaziantep FK", teamId: 3573, fullName: "Kerem Aktürkoğlu", shortName: "Aktürkoğlu" }, right: { teamName: "Çaykur Rizespor", teamId: 1007, fullName: "Gökhan Gönül", shortName: "Gönül" } },
] as const;

describe("Anton kuyruk/nokta — Oyuncu Karşılaştırması", async () => {
  await mkdir(OUTPUT_DIR, { recursive: true });
  const brandLogo = await loadBrandLogo();
  const photo = await inspectImageBytes(await syntheticPhoto(), "sentetik");
  assert.ok(photo.ok);
  for (const id of MATCH_DAY_FORMAT_IDS) {
    for (const pair of PAIRS) {
      test(`${pair.key} ${id}`, async () => {
        const frame = MATCH_DAY_FRAMES[id];
        const left = { ...H2H_LEFT, ...pair.left, nameOrigin: "tr" as const, teamOrigin: "tr" as const };
        const right = { ...H2H_RIGHT, ...pair.right, nameOrigin: "tr" as const, teamOrigin: "tr" as const, league: H2H_LEFT.league, competitions: H2H_LEFT.competitions };
        const built = buildH2HCard({ left, right, mode: "PER90", match: { homeTeam: pair.left.teamName, awayTeam: pair.right.teamName, kickoffUtc: "2026-11-05T17:45:00Z", homeOrigin: "tr", awayOrigin: "tr" }, images: { leftLogo: null, rightLogo: null, leftFace: null, rightFace: null, brandLogo }, frame });
        assert.ok(built.ok, built.ok ? "" : built.error.message);
        const { card } = built.data;
        const { poster, compare } = h2hGeometries(frame);
        for (const [g, blocks] of [[poster, H2H_POSTER_BLOCKS], [compare, H2H_COMPARE_BLOCKS]] as const) {
          const { issues } = await checkLayout(frame, (only) => renderH2HLayer(card, g, only), blocks);
          assert.equal(issues.length, 0, `${pair.key} ${id} ${g.page}: ${describeLayoutIssues(issues)}`);
        }
        const pages = await renderH2HImages({ card, frame, photos: { home: photo.data, away: photo.data }, seedKey: `anton-h2h-${pair.key}` });
        assert.ok(pages.ok, pages.ok ? "" : pages.error.message);
        await Promise.all(pages.data.map((png, index) => writeFile(path.join(OUTPUT_DIR, `h2h-${pair.key}_${id}_${index + 1}.png`), png)));
      });
    }
  }
});
