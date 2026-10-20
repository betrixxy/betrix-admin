"use server";

import { z } from "zod";
import { getCurrentSession } from "@/lib/auth/require-session";
import { addCoach, dismissLegacyAsset } from "@/lib/archive/mutations";
import { syncTeam } from "@/lib/archive/sync";
import { refreshDashboard, UNAUTHORIZED_MESSAGE } from "@/lib/dashboard/action-utils";
import { prisma } from "@/lib/prisma";
import { apiSearchTerm } from "@/lib/services/api-football/search-term";
import { getCoachById, searchCoaches, searchTeams, type CoachSearchHit, type TeamInfo } from "@/lib/services/api-football/team-directory";
import type { ArchiveActionState } from "@/types/archive";

/**
 * Arşiv dizini: teknik direktör ekleme (API'de adla arama ya da elle ad), API'den takım ekleme
 * (kadroyla), etiket bekleyen eski fotoğrafı gizleme. API çağrıları yalnızca okumadır.
 */

const positiveId = z.coerce.number().int().positive();

function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

export interface SearchResult<T> {
  hits?: T[];
  error?: string;
}

export async function searchCoachesAction(query: string): Promise<SearchResult<CoachSearchHit>> {
  if (!(await getCurrentSession())) return { error: UNAUTHORIZED_MESSAGE };
  if (!apiSearchTerm(query)) return { error: "En az 3 harf yazın." };
  const result = await searchCoaches(query);
  return result.ok ? { hits: result.data } : { error: result.error.message };
}

export async function addCoachAction(_prev: ArchiveActionState, formData: FormData): Promise<ArchiveActionState> {
  if (!(await getCurrentSession())) return { error: UNAUTHORIZED_MESSAGE };
  const teamId = positiveId.safeParse(field(formData, "teamId"));
  if (!teamId.success) return { error: "Takım bulunamadı." };
  const coachId = positiveId.safeParse(field(formData, "coachId"));
  let added;
  if (coachId.success) {
    const coach = await getCoachById(coachId.data);
    if (!coach.ok) return { error: coach.error.message };
    if (!coach.data) return { error: "Teknik direktör API-Football'da bulunamadı." };
    const apiName = coach.data.name?.trim() || [coach.data.firstname, coach.data.lastname].filter(Boolean).join(" ");
    added = await addCoach(teamId.data, { source: "API", apiId: coach.data.id, apiName, firstname: coach.data.firstname, lastname: coach.data.lastname });
  } else {
    added = await addCoach(teamId.data, { source: "MANUAL", name: field(formData, "name") });
  }
  if (!added.ok) return { error: added.error.message };
  refreshDashboard();
  return { notice: `${added.data.name} teknik direktör olarak eklendi.` };
}

export async function searchTeamsAction(query: string): Promise<SearchResult<TeamInfo & { inArchive: boolean }>> {
  if (!(await getCurrentSession())) return { error: UNAUTHORIZED_MESSAGE };
  if (!apiSearchTerm(query)) return { error: "En az 3 harf yazın." };
  const result = await searchTeams(query);
  if (!result.ok) return { error: result.error.message };
  const known = new Set((await prisma.team.findMany({ where: { id: { in: result.data.map((team) => team.id) } }, select: { id: true } })).map((team) => team.id));
  return { hits: result.data.map((team) => ({ ...team, inArchive: known.has(team.id) })) };
}

/** API'den takım + kadro + teknik direktör; ligi o sezonun yurt içi ligi (`ensureTeam`). */
export async function addTeamAction(_prev: ArchiveActionState, formData: FormData): Promise<ArchiveActionState> {
  if (!(await getCurrentSession())) return { error: UNAUTHORIZED_MESSAGE };
  const teamId = positiveId.safeParse(field(formData, "teamId"));
  if (!teamId.success) return { error: "Takım seçin." };
  const synced = await syncTeam(teamId.data, { force: true });
  if (!synced.ok) return { error: synced.error.message };
  const team = await prisma.team.findUnique({ where: { id: teamId.data }, select: { officialName: true, currentLeague: { select: { officialName: true } } } });
  refreshDashboard();
  return { notice: `${team?.officialName ?? teamId.data} arşive eklendi (${team?.currentLeague?.officialName ?? "lig bilinmiyor"}): ${synced.data.peopleAdded} yeni kişi.` };
}

export async function dismissLegacyAssetAction(_prev: ArchiveActionState, formData: FormData): Promise<ArchiveActionState> {
  if (!(await getCurrentSession())) return { error: UNAUTHORIZED_MESSAGE };
  const assetId = field(formData, "assetId");
  if (!assetId) return { error: "Fotoğraf bulunamadı." };
  const dismissed = field(formData, "dismissed") !== "0";
  const result = await dismissLegacyAsset(assetId, dismissed);
  if (!result.ok) return { error: result.error.message };
  refreshDashboard();
  return { notice: dismissed ? "Gizlendi — arşive alınmadı." : "Geri getirildi." };
}
