import type { ReelContext } from "@/lib/reels/context-rule";
import { LINEUP_FORMATIONS, type ReelLineupEdits, resolveLineup } from "@/lib/reels/lineup-rule";
import { isReelSquadFresh, type ReelSquadPlayer } from "@/lib/reels/squad-rule";

/** Panel düzenleyicisinin görünümü (saf): varsayılan 11, kadro seçenekleri, kilit nedeni. */

export interface LineupEditorView {
  side: "home" | "away";
  teamName: string;
  formation: string;
  formations: string[];
  /** 11 yer: oyuncu kimliği, boşsa null. */
  playerIds: (number | null)[];
  squad: { id: number; label: string }[];
  edited: boolean;
  /** Son maç verisinde olup oynayamayacak oyuncular: panelde bilgi. */
  notes: string[];
  disabledReason: string | null;
}

interface ViewInput {
  project: { homeTeamId: number; homeName: string; awayTeamId: number; awayName: string; lineupEdits: unknown };
  context: unknown;
  squads: readonly { teamId: number; players: unknown; checkedAt: Date }[];
  now: Date;
}

export function reelLineupEditors({ project, context, squads, now }: ViewInput): LineupEditorView[] {
  const ctx = context as ReelContext | null;
  const edits = (project.lineupEdits ?? { home: null, away: null }) as ReelLineupEdits;
  return (["home", "away"] as const).map((side) => {
    const teamId = side === "home" ? project.homeTeamId : project.awayTeamId;
    const row = squads.find((item) => item.teamId === teamId);
    const fresh = row !== undefined && isReelSquadFresh(row.checkedAt, now);
    const players = fresh ? (row.players as ReelSquadPlayer[]) : [];
    const ids = new Set(players.map((player) => player.id));
    const edit = edits[side] ?? null;
    const last = ctx?.teams?.[side]?.lineup ?? null;
    const absent = (ctx?.absences?.[side] ?? []).filter((item) => item.status !== "doubtful").map((item) => ({ id: item.player_id, name: item.name }));
    const resolved = resolveLineup({ last, edit, absent, inSquad: (id) => ids.has(id) });
    const formation = resolved?.formation ?? ctx?.teams?.[side]?.formation?.name ?? "4-2-3-1";
    return {
      side,
      teamName: side === "home" ? project.homeName : project.awayName,
      formation,
      formations: [...new Set([formation, ...LINEUP_FORMATIONS])],
      playerIds: resolved ? resolved.slots.map((slot) => slot.player?.id ?? null) : Array.from({ length: 11 }, () => null),
      squad: [...players].sort((a, b) => a.name.localeCompare(b.name, "tr-TR")).map((player) => ({ id: player.id, label: player.number ? `${player.number} · ${player.name}` : player.name })),
      edited: edit !== null,
      notes: (resolved?.changes ?? []).map((change) => (change.in ? `${change.out.name} yerine ${change.in.name}` : `${change.out.name} eksik, yeri "?"`)),
      disabledReason: fresh ? null : "Güncel kadro doğrulanamadı: önce veriyi dondurun.",
    };
  });
}
