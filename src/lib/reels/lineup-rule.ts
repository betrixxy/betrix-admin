/**
 * Muhtemel 11 kuralı (saf): son resmî maçın ilk 11'i + eksikler + kadro doğrulaması, panelden düzenlendiyse editör kararı.
 * Kesinlik iddiası yok. Panel de video paketi de aynı kuralı kullanır (`reels-video/src/story/team-card.ts`).
 */

export interface ReelLineupPlayer { id: number; name: string; short_name: string; number: number | null }
/** Dondurulan son maç: oyuncular kaleciden forvete, hat içinde sağlayıcının `grid` sütun sırasıyla. */
export interface ReelLastLineup { fixture_id: number; date: string; formation: string; players: ReelLineupPlayer[] }
/** Panelden düzenleme: 11 yer, dizilişin kaleciden forvete sırasıyla. `null` = "?". */
export interface ReelLineupEdit { formation: string; players: (ReelLineupPlayer | null)[] }
export interface ReelLineupEdits { home: ReelLineupEdit | null; away: ReelLineupEdit | null }

export const LINEUP_FORMATIONS = ["4-2-3-1", "4-3-3", "4-4-2", "4-1-4-1", "3-4-3", "3-5-2", "3-4-2-1", "3-4-1-2", "5-3-2", "5-4-1", "4-3-1-2", "4-1-2-1-2"] as const;
export type LineupZone = "kale" | "defans" | "orta saha" | "forvet";

export interface LineupSlot { line: number; index: number; line_size: number; player: ReelLineupPlayer | null }
export interface LineupChange { slot: number; out: { id: number; name: string }; in: { id: number; name: string } | null; zone: LineupZone }
export interface ResolvedLineup { formation: string; source: "last_match" | "editor"; slots: LineupSlot[]; changes: LineupChange[] }

/** Hazırlık maçları resmî sayılmaz. */
export const isOfficialLeague = (name: string | null | undefined): boolean => !/friendl/iu.test(name ?? "");

/** Kaleci dahil hat boyları; geçersiz dizilişte null. */
export function formationLines(formation: string): number[] | null {
  const parts = formation.split("-").map((part) => Number.parseInt(part, 10));
  if (parts.length < 2 || parts.some((count) => !Number.isInteger(count) || count < 1)) return null;
  return parts.reduce((sum, count) => sum + count, 0) === 10 ? [1, ...parts] : null;
}

export function zoneOfLine(line: number, lineCount: number): LineupZone {
  if (line === 0) return "kale";
  if (line === 1) return "defans";
  return line === lineCount - 1 ? "forvet" : "orta saha";
}

/** Yer → hat. */
export function formationSlots(lines: readonly number[]): { line: number; index: number; line_size: number }[] {
  return lines.flatMap((size, line) => Array.from({ length: size }, (_, index) => ({ line, index, line_size: size })));
}

export interface ResolveInput {
  last: ReelLastLineup | null;
  edit: ReelLineupEdit | null;
  /** Oynamayacak oyuncular (sakat, cezalı), en büyük katkı önce. Şüpheli olan listeye girmez. */
  absent: readonly { id: number; name: string }[];
  inSquad: (playerId: number) => boolean;
}

/** Kadroda doğrulanamayan oyuncu "?" olur, adı anılmaz. Değişiklik yalnız aynı dizilişte aynı yer için söylenir. */
export function resolveLineup({ last, edit, absent, inSquad }: ResolveInput): ResolvedLineup | null {
  const formation = edit?.formation ?? last?.formation ?? null;
  const lines = formation ? formationLines(formation) : null;
  if (!formation || !lines) return null;
  const picks = edit ? edit.players : last?.players;
  if (!picks || picks.length !== 11) return null;
  const absentIds = new Set(absent.map((item) => item.id));
  const usable = (player: ReelLineupPlayer | null): ReelLineupPlayer | null => (player && inSquad(player.id) && (edit !== null || !absentIds.has(player.id)) ? player : null);
  const slots = formationSlots(lines).map((place, slot) => ({ ...place, player: usable(picks[slot] ?? null) }));
  const sameShape = last !== null && last.formation === formation && last.players.length === 11;
  const rank = (id: number) => absent.findIndex((item) => item.id === id);
  const changes = !sameShape ? [] : last.players.flatMap((player, slot): LineupChange[] => {
    const place = slots[slot];
    if (!place || !absentIds.has(player.id) || !inSquad(player.id) || place.player?.id === player.id) return [];
    return [{ slot, out: { id: player.id, name: player.name }, in: place.player ? { id: place.player.id, name: place.player.name } : null, zone: zoneOfLine(place.line, lines.length) }];
  }).sort((a, b) => rank(a.out.id) - rank(b.out.id));
  return { formation, source: edit ? "editor" : "last_match", slots, changes };
}

/** Panel kaydı: diziliş geçerli, 11 yer, tekrar yok, herkes güncel kadroda. */
export function lineupEditProblem(edit: ReelLineupEdit, squadIds: ReadonlySet<number>): string | null {
  if (!formationLines(edit.formation)) return "Diziliş geçersiz: kaleci hariç toplam 10 oyuncu olmalı.";
  if (edit.players.length !== 11) return "11 yer doldurulmalı (boş yer \"?\" görünür).";
  const ids = edit.players.flatMap((player) => (player ? [player.id] : []));
  if (new Set(ids).size !== ids.length) return "Aynı oyuncu iki yerde olamaz.";
  return ids.every((id) => squadIds.has(id)) ? null : "Seçilen oyuncu güncel kadroda doğrulanamadı.";
}
