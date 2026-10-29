import { renderLineupCard } from "@/lib/dashboard/lineup-render";
import { standingsCapacity } from "@/lib/dashboard/standings-layout";
import { renderStandingsCard } from "@/lib/dashboard/standings-render";
import { weeklyLayout, weeklyPlan } from "@/lib/dashboard/weekly-fixtures-layout";
import { renderWeeklyFixturesCard } from "@/lib/dashboard/weekly-fixtures-render";
import type { SocialFormatId } from "@/types/studio-formats";
import type { WeeklyFixturesCardInput } from "@/types/weekly-fixtures";
import { LINEUP_CASES, STANDINGS_CASES, WEEKLY_CASES, standingsForFormat, weeklyForFormat } from "../fixtures/studio-cards";

/**
 * Stüdyo kartlarının (Muhtemel 11, Haftanın Maçları, Puan Durumu) sentetik çizimi —
 * görsel regresyon testi ve dal karşılaştırması (önce/sonra) aynı fonksiyondan çizer.
 */

export const STUDIO_CARDS = ["lineup", "weekly", "standings"] as const;
export type StudioCard = (typeof STUDIO_CARDS)[number];

export function studioCases(card: StudioCard): string[] {
  const cases = { lineup: LINEUP_CASES, weekly: WEEKLY_CASES, standings: STANDINGS_CASES }[card];
  return Object.keys(cases);
}

/** Haftanın Maçları senaryosu, formata sığan maçlarla (1:1'de 9 maçlık hafta sığmaz). */
export function weeklyCase(name: string, format: SocialFormatId): WeeklyFixturesCardInput {
  const input = WEEKLY_CASES[name]!;
  return weeklyForFormat(input, format, (matches) => weeklyPlan(matches, input.grouping, weeklyLayout(format)) !== null);
}

/** Üretimdeki çizim yolu (yerleşim kapısı dahil): kapıya takılırsa sebep hata olarak fırlar, test düşer. */
export async function renderStudioCase(card: StudioCard, name: string, format: SocialFormatId): Promise<Buffer> {
  const result =
    card === "lineup"
      ? await renderLineupCard({ ...LINEUP_CASES[name]!, format }).then((r) => (r.ok ? { ok: true as const, data: r.data.png } : r))
      : card === "weekly"
        ? await renderWeeklyFixturesCard(weeklyCase(name, format))
        : await renderStandingsCard(standingsForFormat(STANDINGS_CASES[name]!, format, standingsCapacity(format)));
  if (!result.ok) throw new Error(`${card}/${name}/${format}: ${result.error.message}`);
  return result.data;
}
