"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentSession } from "@/lib/auth/require-session";
import { UNAUTHORIZED_MESSAGE } from "@/lib/dashboard/action-utils";
import { createStandingsDraft, resolveStandingsCard } from "@/lib/dashboard/standings-engine";
import { renderStandingsCard } from "@/lib/dashboard/standings-render";
import { SUPPORTED_LEAGUES, getSupportedLeague, type SupportedLeagueId } from "@/lib/services/api-football/leagues";
import { loadStandings } from "@/lib/services/api-football/standings";
import type { Result } from "@/types/result";
import type { StandingsLoadResult } from "@/types/standings";
import { DEFAULT_SOCIAL_FORMAT, SOCIAL_FORMAT_IDS } from "@/types/studio-formats";

function unauthorized<T>(): Result<T> {
  return { ok: false, error: { code: "UNAUTHORIZED", message: UNAUTHORIZED_MESSAGE } };
}

const leagueIdSchema = z.enum(SUPPORTED_LEAGUES.map((league) => league.id) as [SupportedLeagueId, ...SupportedLeagueId[]]);
const seasonSchema = z.number().int().min(2000).max(2100);
const fixtureIdSchema = z.string().regex(/^api-football-\d+$/);
const draftSchema = z
  .object({
    leagueId: leagueIdSchema,
    season: seasonSchema,
    groupKey: z.string().trim().min(1).max(80),
    rankFrom: z.number().int().min(1).max(64),
    rankTo: z.number().int().min(1).max(64),
    title: z.string().trim().min(1, "Kart başlığı boş olamaz.").max(40),
    format: z.enum(SOCIAL_FORMAT_IDS).default(DEFAULT_SOCIAL_FORMAT),
  })
  .refine((draft) => draft.rankFrom <= draft.rankTo, "Sıra aralığının başı sonundan büyük olamaz.");

function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Form alanları geçersiz.";
}

/** Ligin sezonları ve (verilmezse güncel) sezonun puan durumu — form grup/aralık seçeneklerini buradan kurar. */
export async function loadStandingsAction(leagueId: unknown, season?: unknown): Promise<Result<StandingsLoadResult>> {
  if (!(await getCurrentSession())) return unauthorized();
  const league = leagueIdSchema.safeParse(leagueId);
  const year = season === undefined ? undefined : seasonSchema.safeParse(season);
  if (!league.success || (year && !year.success)) return { ok: false, error: { code: "INVALID_INPUT", message: "Geçersiz lig ya da sezon." } };
  const result = await loadStandings(getSupportedLeague(league.data).apiFootballId, year?.data);
  return result.ok ? result : { ok: false, error: { code: result.error.code, message: result.error.message } };
}

/** Kartı çizer — kaydetmez (yalnızca önizleme). */
export async function previewStandingsAction(input: unknown): Promise<Result<{ dataUrl: string }>> {
  if (!(await getCurrentSession())) return unauthorized();
  const parsed = draftSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: { code: "INVALID_INPUT", message: firstIssue(parsed.error) } };
  const card = await resolveStandingsCard(parsed.data);
  if (!card.ok) return card;
  try {
    const png = await renderStandingsCard(card.data);
    return { ok: true, data: { dataUrl: `data:image/png;base64,${png.toString("base64")}` } };
  } catch (cause) {
    console.error("[standings] önizleme çizilemedi:", cause);
    return { ok: false, error: { code: "RENDER_FAILED", message: "Önizleme çizilemedi.", cause } };
  }
}

/** "Kaydet / İçerik Üret": kartı çizip DRAFT olarak kaydeder (onaysız yayına hazır sayılmaz). */
export async function saveStandingsAction(input: unknown, anchorFixtureId: unknown): Promise<Result<{ id: string }>> {
  if (!(await getCurrentSession())) return unauthorized();
  const parsed = draftSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: { code: "INVALID_INPUT", message: firstIssue(parsed.error) } };
  const anchor = fixtureIdSchema.safeParse(anchorFixtureId);
  const saved = await createStandingsDraft(parsed.data, anchor.success ? anchor.data : null);
  if (!saved.ok) return saved;
  revalidatePath("/calendar");
  revalidatePath("/dashboard/matches");
  return saved;
}
