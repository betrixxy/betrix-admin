import type { StandingsResponseRaw, StandingsRowRaw } from "@/lib/services/api-football/standings-mappers";

/** Kurgusal API-Football `/standings` satırları — "Puan Durumu" eşleyici/yerleşim testleri için (şema birebir). */
export function rawStanding(rank: number, group: string, overrides: { teamId?: number; name?: string; description?: string | null; played?: number } = {}): StandingsRowRaw {
  const played = overrides.played ?? 8;
  const win = Math.max(0, 7 - Math.floor(rank / 3));
  const draw = Math.min(played - win, rank % 3);
  const lose = played - win - draw;
  const goalsFor = 22 - rank;
  const goalsAgainst = 4 + rank;
  return {
    rank,
    team: { id: overrides.teamId ?? 1000 + rank, name: overrides.name ?? `Kurgu Takım ${rank}`, logo: `https://media.api-sports.io/football/teams/${overrides.teamId ?? 1000 + rank}.png` },
    points: win * 3 + draw,
    goalsDiff: goalsFor - goalsAgainst,
    group,
    description: overrides.description === undefined ? null : overrides.description,
    all: { played, win, draw, lose, goals: { for: goalsFor, against: goalsAgainst } },
  };
}

function leagueDescription(rank: number): string | null {
  if (rank === 1) return "Promotion - Champions League (League phase: )";
  if (rank === 2) return "Promotion - Champions League (Qualification)";
  if (rank <= 4) return "Promotion - Europa League (Qualification)";
  if (rank >= 18) return "Relegation - 1. Lig";
  return null;
}

/** 20 takımlı tek tablo (Süper Lig biçimi). */
export const RAW_LEAGUE_TABLE: StandingsRowRaw[] = Array.from({ length: 20 }, (_, i) => rawStanding(i + 1, "Süper Lig", { description: leagueDescription(i + 1) }));

/** 36 takımlı UCL lig aşaması: 1-8 son 16, 9-24 play-off, 25-36 elendi. */
export const RAW_LEAGUE_PHASE: StandingsRowRaw[] = Array.from({ length: 36 }, (_, i) =>
  rawStanding(i + 1, "UEFA Champions League", {
    description: i < 8 ? "Promotion - Champions League (Round of 16)" : i < 24 ? "Promotion - Champions League (Play Offs: 1/16-finals)" : null,
  }),
);

/** Eski kupa formatı: API grupları karışık sırayla verebilir (D, A, C, B). */
export const RAW_GROUPS: StandingsRowRaw[][] = ["D", "A", "C", "B"].map((letter, g) =>
  Array.from({ length: 4 }, (_, i) => rawStanding(i + 1, `Group ${letter}`, { teamId: 2000 + g * 10 + i, description: i < 2 ? "Promotion - Champions League (Round of 16)" : null })),
);

export function rawStandingsResponse(tables: StandingsRowRaw[][]): StandingsResponseRaw {
  return { response: [{ league: { logo: "https://media.api-sports.io/football/leagues/203.png", standings: tables } }] };
}
