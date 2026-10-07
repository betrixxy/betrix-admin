import type { ApiFootballLineupRaw, ApiFootballSquadRaw } from "@/lib/services/api-football/types";
import { LINEUP_SIZE, type ReferenceStarter, type SquadPlayer, type SquadPosition } from "@/types/lineup";

/** Muhtemel 11 — API-Football ham kadro/diziliş → kanonik tipler (saf fonksiyonlar). */

const POSITION_MAP: Record<string, SquadPosition> = {
  goalkeeper: "G", defender: "D", midfielder: "M", attacker: "F", g: "G", d: "D", m: "M", f: "F",
};

export function mapSquadPosition(value: string | null | undefined): SquadPosition | null {
  return value ? (POSITION_MAP[value.trim().toLowerCase()] ?? null) : null;
}

const POSITION_ORDER: Record<SquadPosition, number> = { G: 0, D: 1, M: 2, F: 3 };

/** Kadro: pozisyon, sonra forma numarası sırasıyla (formdaki seçim listesi bu sırayı kullanır). */
export function mapSquad(raw: ApiFootballSquadRaw[], teamId: number): SquadPlayer[] {
  return raw
    .filter((entry) => entry.team.id === teamId)
    .flatMap((entry) => entry.players)
    .filter((p) => p.name)
    .map((p) => ({ id: p.id, name: p.name ?? "", number: p.number ?? null, position: mapSquadPosition(p.position) }))
    .sort(
      (a, b) =>
        (a.position ? POSITION_ORDER[a.position] : 9) - (b.position ? POSITION_ORDER[b.position] : 9) ||
        (a.number ?? 999) - (b.number ?? 999),
    );
}

function parseGrid(grid: string | null): [number, number] {
  const match = /^(\d+):(\d+)$/.exec(grid ?? "");
  return match ? [Number(match[1]), Number(match[2])] : [99, 99];
}

/**
 * İlk 11, dizilişin satır sırasına dizilir: `grid` "satır:sütun" — satır 1 kaleci, sütun 1
 * takımın solu (sol bek "2:1"). Bu sıra formdaki ve karttaki pozisyon sırasıyla birebir aynıdır.
 */
export function orderStarters(starters: ReferenceStarter[]): ReferenceStarter[] {
  return [...starters].sort((a, b) => {
    const [ra, ca] = parseGrid(a.grid);
    const [rb, cb] = parseGrid(b.grid);
    return ra - rb || ca - cb;
  });
}

/** Takımın 11 kişilik dizilişi — ilk 11'i eksik ya da bozuk olan diziliş kullanılmaz. */
export function findTeamLineup(lineups: ApiFootballLineupRaw[], teamId: number): ApiFootballLineupRaw | null {
  const lineup = lineups.find((entry) => entry.team.id === teamId);
  return lineup && (lineup.startXI?.length ?? 0) === LINEUP_SIZE ? lineup : null;
}

/**
 * Diziliş ve tüm oyuncuların saha konumu (`grid`) var mı? Kupa gibi düşük kapsamlı maçlarda API
 * ilk 11'i konumsuz verir — o zaman oyuncular hangi satıra ait bilinmez.
 */
export function isCompleteLineup(lineup: ApiFootballLineupRaw): boolean {
  return Boolean(lineup.formation) && (lineup.startXI ?? []).every(({ player }) => /^\d+:\d+$/.test(player.grid ?? ""));
}

export function lineupStarters(lineup: ApiFootballLineupRaw): ReferenceStarter[] {
  return orderStarters(
    (lineup.startXI ?? []).map(({ player }) => ({
      id: player.id ?? null,
      name: player.name,
      number: player.number ?? null,
      grid: player.grid ?? null,
    })),
  );
}

/** API forma rengi "e41e2c" → "#e41e2c"; geçersizse boş. */
export function lineupColorHex(lineup: ApiFootballLineupRaw): string {
  const raw = lineup.team.colors?.player?.primary?.trim().replace(/^#/, "") ?? "";
  return /^[0-9a-f]{6}$/i.test(raw) ? `#${raw.toLowerCase()}` : "";
}
