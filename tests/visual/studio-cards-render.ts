import assert from "node:assert/strict";
import { renderLineupCard } from "@/lib/dashboard/lineup-render";
import { standingsCapacity } from "@/lib/dashboard/standings-layout";
import { renderStandingsCard } from "@/lib/dashboard/standings-render";
import { inspectImageBytes, type UploadedImage } from "@/lib/dashboard/studio-images";
import { weeklyLayout, weeklyPlan } from "@/lib/dashboard/weekly-fixtures-layout";
import { renderWeeklyFixturesCard } from "@/lib/dashboard/weekly-fixtures-render";
import type { LineupCardInput } from "@/types/lineup";
import type { SocialFormatId } from "@/types/studio-formats";
import type { WeeklyFixturesCardInput } from "@/types/weekly-fixtures";
import { LINEUP_CASES, STANDINGS_CASES, WEEKLY_CASES, standingsForFormat, weeklyForFormat } from "../fixtures/studio-cards";
import { syntheticPhoto } from "./synthetic-photo";

/**
 * Stüdyo kartlarının (Muhtemel 11 — Taktik Tahtası + Kahraman Liste, Haftanın Maçları, Puan Durumu) sentetik
 * çizimi — görsel regresyon testi ve dal karşılaştırması (önce/sonra) aynı fonksiyondan çizer.
 */

export const STUDIO_CARDS = ["lineup", "lineup-hero", "weekly", "standings"] as const;
export type StudioCard = (typeof STUDIO_CARDS)[number];

export function studioCases(card: StudioCard): string[] {
  const cases = { lineup: LINEUP_CASES, "lineup-hero": LINEUP_CASES, weekly: WEEKLY_CASES, standings: STANDINGS_CASES }[card];
  return Object.keys(cases);
}

/** Haftanın Maçları senaryosu, formata sığan maçlarla (1:1'de 9 maçlık hafta sığmaz). */
export function weeklyCase(name: string, format: SocialFormatId): WeeklyFixturesCardInput {
  const input = WEEKLY_CASES[name]!;
  return weeklyForFormat(input, format, (matches) => weeklyPlan(matches, input.grouping, weeklyLayout(format)) !== null);
}

let photo: Promise<UploadedImage> | null = null;
/** Sentetik kapak fotoğrafı (telifli fotoğraf repoya girmez) — arşivin "kart için" sürümü yerine. */
function heroPhoto(): Promise<UploadedImage> {
  photo ??= syntheticPhoto().then(async (bytes) => {
    const image = await inspectImageBytes(bytes, "sentetik kapak");
    assert.ok(image.ok);
    return image.data;
  });
  return photo;
}

/** Kahraman Liste senaryosu: uzun adlı senaryoda elle kadraj (otomatik dışı yol da sabitlenir). */
async function heroCase(name: string, format: SocialFormatId): Promise<LineupCardInput> {
  const base = LINEUP_CASES[name]!;
  const heroAdjust = name === "uzun-adlar" ? { x: 0.3, y: -0.2, zoom: 1.3 } : null;
  return { ...base, format, templateStyle: "hero_list", team: { ...base.team, heroPhotoId: "sentetik", heroAdjust }, heroPhoto: await heroPhoto() };
}

/** Üretimdeki çizim yolu (yerleşim kapısı dahil): kapıya takılırsa sebep hata olarak fırlar, test düşer. */
export async function renderStudioCase(card: StudioCard, name: string, format: SocialFormatId): Promise<Buffer> {
  const lineup = async (input: LineupCardInput, expected: "pitch" | "hero_list") => {
    const r = await renderLineupCard(input);
    if (r.ok) assert.equal(r.data.templateStyle, expected, `${card}/${name}/${format}: şablon`);
    return r.ok ? { ok: true as const, data: r.data.png } : r;
  };
  const result =
    card === "lineup"
      ? await lineup({ ...LINEUP_CASES[name]!, format }, "pitch")
      : card === "lineup-hero"
        ? await lineup(await heroCase(name, format), "hero_list")
        : card === "weekly"
          ? await renderWeeklyFixturesCard(weeklyCase(name, format))
          : await renderStandingsCard(standingsForFormat(STANDINGS_CASES[name]!, format, standingsCapacity(format)));
  if (!result.ok) throw new Error(`${card}/${name}/${format}: ${result.error.message}`);
  return result.data;
}
