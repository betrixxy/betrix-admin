"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentSession } from "@/lib/auth/require-session";
import { UNAUTHORIZED_MESSAGE } from "@/lib/dashboard/action-utils";
import { createWeeklyFixturesDraft, resolveWeeklyCard } from "@/lib/dashboard/weekly-fixtures-engine";
import { renderWeeklyFixturesCard } from "@/lib/dashboard/weekly-fixtures-render";
import { SUPPORTED_LEAGUES, getSupportedLeague, type SupportedLeagueId } from "@/lib/services/api-football/leagues";
import { getWeeklyRoundMatches, getWeeklyRounds } from "@/lib/services/api-football/weekly-fixtures";
import type { Result } from "@/types/result";
import { WEEKLY_MAX_MATCHES, type WeeklyRoundMatches, type WeeklyRoundsResult } from "@/types/weekly-fixtures";

function unauthorized<T>(): Result<T> {
  return { ok: false, error: { code: "UNAUTHORIZED", message: UNAUTHORIZED_MESSAGE } };
}

const leagueIdSchema = z.enum(SUPPORTED_LEAGUES.map((league) => league.id) as [SupportedLeagueId, ...SupportedLeagueId[]]);
const seasonSchema = z.number().int().min(2000).max(2100);
const fixtureIdSchema = z.string().regex(/^api-football-\d+$/);
const draftSchema = z.object({
  leagueId: leagueIdSchema,
  season: seasonSchema,
  roundKey: z.string().trim().min(1).max(80),
  title: z.string().trim().min(1, "Kart başlığı boş olamaz.").max(60),
  matchIds: z.array(fixtureIdSchema).min(1, "Karta en az bir maç ekleyin.").max(WEEKLY_MAX_MATCHES, `Bir kart en fazla ${WEEKLY_MAX_MATCHES} maç taşır.`),
});

function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Form alanları geçersiz.";
}

/** Ligin sezonları ve turları; `season` yoksa güncel sezon (güncel tur işaretli). */
export async function loadWeeklyRoundsAction(leagueId: unknown, season?: unknown): Promise<Result<WeeklyRoundsResult>> {
  if (!(await getCurrentSession())) return unauthorized();
  const league = leagueIdSchema.safeParse(leagueId);
  const year = season === undefined ? undefined : seasonSchema.safeParse(season);
  if (!league.success || (year && !year.success)) return { ok: false, error: { code: "INVALID_INPUT", message: "Geçersiz lig ya da sezon." } };
  const result = await getWeeklyRounds(getSupportedLeague(league.data).apiFootballId, year?.data);
  return result.ok ? result : { ok: false, error: { code: result.error.code, message: result.error.message } };
}

/** Seçilen turun tüm maçları (Türkiye saatiyle) — form listeyi buradan kurar. */
export async function loadWeeklyMatchesAction(input: unknown): Promise<Result<WeeklyRoundMatches>> {
  if (!(await getCurrentSession())) return unauthorized();
  const parsed = z.object({ leagueId: leagueIdSchema, season: seasonSchema, roundKey: z.string().min(1).max(80) }).safeParse(input);
  if (!parsed.success) return { ok: false, error: { code: "INVALID_INPUT", message: "Geçersiz tur." } };
  const apiId = getSupportedLeague(parsed.data.leagueId).apiFootballId;
  const rounds = await getWeeklyRounds(apiId, parsed.data.season);
  if (!rounds.ok) return { ok: false, error: { code: rounds.error.code, message: rounds.error.message } };
  const option = rounds.data.options.find((candidate) => candidate.key === parsed.data.roundKey);
  if (!option) return { ok: false, error: { code: "NOT_FOUND", message: "Tur bulunamadı." } };
  const result = await getWeeklyRoundMatches(apiId, parsed.data.season, option);
  return result.ok ? result : { ok: false, error: { code: result.error.code, message: result.error.message } };
}

/** Kartı çizer — kaydetmez (yalnızca önizleme). */
export async function previewWeeklyFixturesAction(input: unknown): Promise<Result<{ dataUrl: string }>> {
  if (!(await getCurrentSession())) return unauthorized();
  const parsed = draftSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: { code: "INVALID_INPUT", message: firstIssue(parsed.error) } };
  const card = await resolveWeeklyCard(parsed.data);
  if (!card.ok) return card;
  try {
    const png = await renderWeeklyFixturesCard(card.data);
    return { ok: true, data: { dataUrl: `data:image/png;base64,${png.toString("base64")}` } };
  } catch (cause) {
    console.error("[weekly-fixtures] önizleme çizilemedi:", cause);
    return { ok: false, error: { code: "RENDER_FAILED", message: "Önizleme çizilemedi.", cause } };
  }
}

/** "Kaydet / İçerik Üret": kartı çizip DRAFT olarak kaydeder (onaysız yayına hazır sayılmaz). */
export async function saveWeeklyFixturesAction(input: unknown, anchorFixtureId: unknown): Promise<Result<{ id: string }>> {
  if (!(await getCurrentSession())) return unauthorized();
  const parsed = draftSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: { code: "INVALID_INPUT", message: firstIssue(parsed.error) } };
  const anchor = fixtureIdSchema.safeParse(anchorFixtureId);
  const saved = await createWeeklyFixturesDraft(parsed.data, anchor.success ? anchor.data : null);
  if (!saved.ok) return saved;
  revalidatePath("/calendar");
  revalidatePath("/dashboard/matches");
  return saved;
}
