import { Prisma } from "@/generated/prisma/client";
import { addDays, istanbulDay } from "@/lib/metrics/istanbul-time";
import { prisma } from "@/lib/prisma";
import { publishWindow } from "@/lib/reels/publish-window";
import { reelQualityOk, reelSceneAvailability } from "@/lib/reels/scenes";
import { screenNoteProblem, voiceNoteProblem } from "@/lib/reels/analyst-note";
import { loadReelContext } from "@/lib/reels/context-data";
import { reelLineupPlayer } from "@/lib/reels/context-rule";
import { lineupEditProblem, type ReelLineupEdit, type ReelLineupEdits } from "@/lib/reels/lineup-rule";
import { isReelSquadFresh, type ReelSquadPlayer } from "@/lib/reels/squad-rule";
import { refreshProjectSquads } from "@/lib/reels/squad-data";
import { contentLanguageGate } from "@/lib/prediction/content-language";
import { canCancelReel, canFreezeReel, isReelSelectable, REEL_STATUS_LABELS, REELS_MAX_DAYS_AHEAD } from "@/lib/reels/selection";
import { getReelsMatch, getReelsMatches } from "@/lib/services/reels-client";
import type { ReelsMatchListItem } from "@/lib/services/reels-schema";
import type { Result } from "@/types/result";

/**
 * Reels projesi yazma yolu. Yalnız admin tıklamasıyla çağrılır (CLAUDE.md 1.10). Maç bilgisi formdan alınmaz;
 * sunucu servisten yeniden okur.
 */

export interface ReelActionError {
  message: string;
}

function projectFields(match: ReelsMatchListItem) {
  const kickoffUtc = new Date(match.kickoff_utc);
  return {
    leagueId: match.league.id,
    leagueName: match.league.name,
    homeTeamId: match.home.id,
    homeName: match.home.name,
    awayTeamId: match.away.id,
    awayName: match.away.name,
    kickoffUtc,
    ...publishWindow(kickoffUtc),
  };
}

const isUniqueViolation = (cause: unknown): boolean =>
  cause instanceof Prisma.PrismaClientKnownRequestError && cause.code === "P2002";

/** Seçim idempotent: seçili maç olduğu gibi kalır, iptal edilmiş proje güncel bilgiyle SELECTED'a döner. */
export async function selectReelMatch(matchId: number, now: Date = new Date()): Promise<Result<{ id: string }, ReelActionError>> {
  const today = istanbulDay(now);
  const list = await getReelsMatches({ from: today, to: addDays(today, REELS_MAX_DAYS_AHEAD) });
  if (!list.ok) return { ok: false, error: { message: list.error.message } };
  const match = list.data.matches.find((item) => item.match_id === matchId);
  if (!match) return { ok: false, error: { message: `Maç önümüzdeki ${REELS_MAX_DAYS_AHEAD} gün içinde bulunamadı.` } };
  if (!isReelSelectable(new Date(match.kickoff_utc), now)) return { ok: false, error: { message: "Maç başladı, seçilemez." } };

  const fields = projectFields(match);
  // Kadro seçimde yenilenir; kaynak hatası seçimi durdurmaz, dondurmada yeniden denenir.
  await refreshProjectSquads({ homeTeamId: match.home.id, homeName: match.home.name, awayTeamId: match.away.id, awayName: match.away.name }, now);
  await prisma.reelProject.updateMany({ where: { matchId, status: "CANCELLED" }, data: { ...fields, status: "SELECTED" } });
  try {
    const project = await prisma.reelProject.upsert({ where: { matchId }, update: {}, create: { matchId, ...fields }, select: { id: true } });
    return { ok: true, data: project };
  } catch (cause) {
    // Aynı maç için eşzamanlı iki istek: ikisi de "yok" görüp eklemeye kalkar. Kazanan kayıt geçerlidir.
    if (!isUniqueViolation(cause)) throw cause;
    const existing = await prisma.reelProject.findUnique({ where: { matchId }, select: { id: true } });
    return existing ? { ok: true, data: existing } : { ok: false, error: { message: "Maç seçilemedi, yeniden deneyin." } };
  }
}

export async function cancelReelProject(projectId: string): Promise<Result<true, ReelActionError>> {
  const project = await prisma.reelProject.findUnique({ where: { id: projectId }, select: { status: true } });
  if (!project) return { ok: false, error: { message: "Proje bulunamadı." } };
  if (!canCancelReel(project.status)) {
    return { ok: false, error: { message: `Bu aşamada iptal edilemez (${REEL_STATUS_LABELS[project.status]}).` } };
  }
  // Okuma ile yazma arasında durum değiştiyse iptal uygulanmaz.
  const changed = await prisma.reelProject.updateMany({ where: { id: projectId, status: project.status }, data: { status: "CANCELLED" } });
  return changed.count === 1 ? { ok: true, data: true } : { ok: false, error: { message: "Proje durumu değişti, sayfayı yenileyin." } };
}

/** Analist notu: kullanıcının kendi yazdığı metin. Dil kapısından geçer; video onaydan sonra değişmesin diye onayda kilitlenir. */
export async function saveReelAnalystNote(projectId: string, note: { screen: string; voice: string }): Promise<Result<true, ReelActionError>> {
  const project = await prisma.reelProject.findUnique({ where: { id: projectId }, select: { status: true } });
  if (!project) return { ok: false, error: { message: "Proje bulunamadı." } };
  if (!canFreezeReel(project.status)) return { ok: false, error: { message: `Bu aşamada not değiştirilemez (${REEL_STATUS_LABELS[project.status]}).` } };
  const screen = note.screen.trim();
  const voice = note.voice.trim();
  const problem = screenNoteProblem(screen) ?? voiceNoteProblem(voice) ?? contentLanguageGate({ card: { ekranOzeti: screen, seslendirmeNotu: voice } });
  if (problem) return { ok: false, error: { message: problem } };
  await prisma.reelProject.update({ where: { id: projectId }, data: { analystScreenNote: screen || null, analystVoiceNote: voice || null } });
  return { ok: true, data: true };
}

/** Muhtemel 11 düzenlemesi: oyuncu bilgisi formdan alınmaz, kimlikle güncel kadrodan okunur. `choice` null: son maçın ilk 11'ine döner. */
export async function saveReelLineup(projectId: string, side: "home" | "away", choice: { formation: string; playerIds: (number | null)[] } | null, now: Date = new Date()): Promise<Result<true, ReelActionError>> {
  const project = await prisma.reelProject.findUnique({ where: { id: projectId }, select: { status: true, homeTeamId: true, awayTeamId: true, lineupEdits: true } });
  if (!project) return { ok: false, error: { message: "Proje bulunamadı." } };
  if (!canFreezeReel(project.status)) return { ok: false, error: { message: `Bu aşamada Muhtemel 11 değiştirilemez (${REEL_STATUS_LABELS[project.status]}).` } };
  let edit: ReelLineupEdit | null = null;
  if (choice) {
    const row = await prisma.reelSquadCheck.findUnique({ where: { teamId: side === "home" ? project.homeTeamId : project.awayTeamId } });
    if (!row || !isReelSquadFresh(row.checkedAt, now)) return { ok: false, error: { message: "Güncel kadro doğrulanamadı: önce veriyi dondurun." } };
    const squad = new Map((row.players as unknown as ReelSquadPlayer[]).map((player) => [player.id, player]));
    edit = {
      formation: choice.formation,
      players: choice.playerIds.map((id) => {
        const player = id === null ? undefined : squad.get(id);
        return id === null ? null : player ? reelLineupPlayer(player.id, player.name, player.number ?? null) : { id, name: "", short_name: "", number: null };
      }),
    };
    const problem = lineupEditProblem(edit, new Set(squad.keys()));
    if (problem) return { ok: false, error: { message: problem } };
  }
  const current = (project.lineupEdits ?? { home: null, away: null }) as unknown as ReelLineupEdits;
  const next: ReelLineupEdits = { ...current, [side]: edit };
  await prisma.reelProject.update({ where: { id: projectId }, data: { lineupEdits: next as unknown as Prisma.InputJsonValue } });
  return { ok: true, data: true };
}

export interface FrozenSnapshot {
  version: number;
  qualityOk: boolean;
  /** Kadro yenilenemeyen takımlar: dondurma durmaz, panelde gösterilir. */
  squadWarnings: string[];
  /** Futbol okumasında okunamayan bölümler: dondurma durmaz, ilgili sahne kapanır. */
  contextWarnings: string[];
  /** Uç başına API-Football isteği (önbellekten dönenler dahil). */
  contextRequests: Record<string, number>;
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

  const squads = await refreshProjectSquads(project);
  const reading = await loadReelContext(project);
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
          squadCheckedAt: squads.checkedAt,
          ...(reading.context ? { context: reading.context as unknown as Prisma.InputJsonValue, contextFetchedAt: new Date(reading.context.fetched_at) } : {}),
        },
        select: { version: true },
      });
      // Maç saati değiştiyse yayın penceresi yeni saate göre güncellenir.
      await tx.reelProject.update({ where: { id: projectId }, data: { status: "SNAPSHOT_READY", kickoffUtc, ...publishWindow(kickoffUtc) } });
      return created;
    });
    return { ok: true, data: { version: snapshot.version, qualityOk, squadWarnings: squads.warnings, contextWarnings: reading.warnings, contextRequests: reading.requests } };
  } catch (cause) {
    if (isUniqueViolation(cause)) return { ok: false, error: { message: "Aynı anda başka bir dondurma yapıldı, sayfayı yenileyin." } };
    throw cause;
  }
}
