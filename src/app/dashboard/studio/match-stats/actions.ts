"use server";

import { z } from "zod";
import { getCurrentSession } from "@/lib/auth/require-session";
import { refreshDashboard, UNAUTHORIZED_MESSAGE } from "@/lib/dashboard/action-utils";
import { validateMatchResultFixture } from "@/lib/dashboard/match-result-studio";
import { createMatchStatsCard } from "@/lib/dashboard/match-stats-engine";
import { loadMatchStatsFacts } from "@/lib/dashboard/match-stats-studio";
import { getMatchResultRaw, parseFixtureId } from "@/lib/services/api-football";
import { MATCH_DAY_FORMAT_IDS } from "@/types/match-day";
import type { MatchStatsActionState } from "@/types/match-stats";

const schema = z.object({
  fixtureId: z.string().regex(/^api-football-\d+$/, "Maç seçilmedi — Maç Merkezi'nden açın."),
  format: z.enum(MATCH_DAY_FORMAT_IDS, "Bir platform formatı seçin."),
  page: z.enum(["SUMMARY", "DETAIL"], "Bir sayfa seçin."),
});

function text(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

/**
 * Tek başına "Maç İstatistikleri" kartı: form → doğrulama → maç (sunucuda yeniden çekilir, yalnızca
 * biten maç) → istatistikler (API-Football + Sportmonks yedek) → motor (yerleşim kapısı). DRAFT doğar.
 */
export async function generateMatchStatsAction(_prevState: MatchStatsActionState, formData: FormData): Promise<MatchStatsActionState> {
  if (!(await getCurrentSession())) return { error: UNAUTHORIZED_MESSAGE };
  const parsed = schema.safeParse({ fixtureId: text(formData, "fixtureId"), format: text(formData, "format"), page: text(formData, "page") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Geçersiz form verisi." };

  const apiId = parseFixtureId(parsed.data.fixtureId);
  const raw = apiId ? await getMatchResultRaw(apiId) : null;
  if (!raw?.ok) return { error: `Maç verisi alınamadı: ${raw?.error.message ?? "geçersiz maç kimliği"}` };
  const validated = validateMatchResultFixture(raw.data, new Date());
  if (!validated.ok) return { error: validated.error.message };
  const stats = raw.data ? await loadMatchStatsFacts(raw.data) : null;
  if (!stats) return { error: "Maç istatistikleri alınamadı — kart üretilmedi." };

  const result = await createMatchStatsCard({ stats, format: parsed.data.format, page: parsed.data.page });
  if (!result.ok) return { error: result.error.message };
  refreshDashboard();
  return { result: result.data };
}
