import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { publishWindow } from "@/lib/reels/publish-window";
import { reelQualityOk, reelSceneAvailability } from "@/lib/reels/scenes";
import { canFreezeReel, isReelSelectable, REEL_STATUS_LABELS, REELS_MAX_DAYS_AHEAD } from "@/lib/reels/selection";
import { addDays, istanbulDay } from "@/lib/metrics/istanbul-time";
import { getReelsMatch, getReelsMatches } from "@/lib/services/reels-client";
import type { Result } from "@/types/result";

/**
 * Reels projesi yazma yolu. Yalnız admin tıklamasıyla çağrılır (CLAUDE.md 1.10). Maç bilgisi formdan alınmaz;
 * sunucu servisten yeniden okur.
 */

export interface ReelActionError {
  message: string;
}

export async function selectReelMatch(matchId: number, now: Date = new Date()): Promise<Result<{ id: string }, ReelActionError>> {
  const today = istanbulDay(now);
  const list = await getReelsMatches({ from: today, to: addDays(today, REELS_MAX_DAYS_AHEAD) });
  if (!list.ok) return { ok: false, error: { message: list.error.message } };
  const match = list.data.matches.find((item) => item.match_id === matchId);
  if (!match) return { ok: false, error: { message: `Maç önümüzdeki ${REELS_MAX_DAYS_AHEAD} gün içinde bulunamadı.` } };

  const kickoffUtc = new Date(match.kickoff_utc);
  if (!isReelSelectable(kickoffUtc, now)) return { ok: false, error: { message: "Maç başladı, seçilemez." } };
  const { publishFrom, publishTo } = publishWindow(kickoffUtc);
  const project = await prisma.reelProject.upsert({
    where: { matchId },
    update: {},
    create: {
      matchId,
      leagueId: match.league.id,
      leagueName: match.league.name,
      homeTeamId: match.home.id,
      homeName: match.home.name,
      awayTeamId: match.away.id,
      awayName: match.away.name,
      kickoffUtc,
      publishFrom,
      publishTo,
    },
    select: { id: true },
  });
  return { ok: true, data: project };
}

export interface FrozenSnapshot {
  version: number;
  qualityOk: boolean;
}

export async function freezeReelSnapshot(projectId: string): Promise<Result<FrozenSnapshot, ReelActionError>> {
  const project = await prisma.reelProject.findUnique({ where: { id: projectId } });
  if (!project) return { ok: false, error: { message: "Proje bulunamadı." } };
  if (!canFreezeReel(project.status)) {
    return { ok: false, error: { message: `Bu aşamada veri dondurulamaz (${REEL_STATUS_LABELS[project.status]}).` } };
  }

  const detail = await getReelsMatch(project.matchId);
  if (!detail.ok) return { ok: false, error: { message: detail.error.message } };
  if (detail.data.match.id !== project.matchId) return { ok: false, error: { message: "Servis başka bir maçın verisini döndürdü." } };

  const qualityOk = reelQualityOk(detail.data);
  const kickoffUtc = new Date(detail.data.match.kickoff_utc);
  try {
    const snapshot = await prisma.$transaction(async (tx) => {
      const latest = await tx.reelSnapshot.aggregate({ where: { projectId }, _max: { version: true } });
      const created = await tx.reelSnapshot.create({
        data: {
          projectId,
          version: (latest._max.version ?? 0) + 1,
          contractVersion: detail.data.contract_version,
          payload: detail.data as unknown as Prisma.InputJsonValue,
          computedAt: new Date(detail.data.model.computed_at),
          modelVersion: detail.data.model.version,
          qualityOk,
          sceneAvailability: reelSceneAvailability(detail.data) as unknown as Prisma.InputJsonValue,
        },
        select: { version: true },
      });
      // Maç saati değiştiyse yayın penceresi yeni saate göre güncellenir.
      await tx.reelProject.update({ where: { id: projectId }, data: { status: "SNAPSHOT_READY", kickoffUtc, ...publishWindow(kickoffUtc) } });
      return created;
    });
    return { ok: true, data: { version: snapshot.version, qualityOk } };
  } catch (cause) {
    if (cause instanceof Prisma.PrismaClientKnownRequestError && cause.code === "P2002") {
      return { ok: false, error: { message: "Aynı anda başka bir dondurma yapıldı, sayfayı yenileyin." } };
    }
    throw cause;
  }
}
