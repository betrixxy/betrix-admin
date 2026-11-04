import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { refreshReelSquads, type ReelSquadDeps, type ReelSquadPlayer, type ReelSquadResult } from "@/lib/reels/squad-rule";
import { getTeamSquad } from "@/lib/services/api-football/squads";

/** Kadro kaynağı ve önbelleği. Yalnız admin tıklamasıyla (seçim, dondurma) çağrılır; zamanlayıcıdan çağrılmaz (CLAUDE.md 1.10). */

const DEPS: ReelSquadDeps = {
  fetchSquad: async (teamId) => {
    const squad = await getTeamSquad(teamId);
    if (!squad.ok) return { ok: false, message: squad.error.message };
    return { ok: true, data: squad.data.flatMap((entry) => (entry.name ? [{ id: entry.id, name: entry.name, number: entry.number }] : [])) };
  },
  readStored: async (teamId) => {
    const row = await prisma.reelSquadCheck.findUnique({ where: { teamId } });
    return row ? { players: row.players as unknown as ReelSquadPlayer[], checkedAt: row.checkedAt } : null;
  },
  store: async (teamId, entry) => {
    const players = entry.players as unknown as Prisma.InputJsonValue;
    await prisma.reelSquadCheck.upsert({ where: { teamId }, create: { teamId, players, checkedAt: entry.checkedAt }, update: { players, checkedAt: entry.checkedAt } });
  },
};

export const refreshProjectSquads = (project: { homeTeamId: number; homeName: string; awayTeamId: number; awayName: string }, now?: Date): Promise<ReelSquadResult> =>
  refreshReelSquads([{ id: project.homeTeamId, name: project.homeName }, { id: project.awayTeamId, name: project.awayName }], DEPS, now);
