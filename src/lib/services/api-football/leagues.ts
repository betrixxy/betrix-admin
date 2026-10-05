export type SupportedLeagueId =
  | "ucl"
  | "uel"
  | "uecl"
  | "premier-league"
  | "la-liga"
  | "serie-a"
  | "bundesliga"
  | "ligue-1"
  | "super-lig"
  | "tff-1-lig";

export interface SupportedLeague {
  id: SupportedLeagueId;
  /** API-Football `league.id` — bkz. https://www.api-football.com/documentation-v3#tag/Leagues */
  apiFootballId: number;
  name: string;
  shortName: string;
}

/**
 * Stüdyo'nun/Takvim'in kapsadığı sabit lig listesi (bkz. kullanıcının referans görseli).
 * API-Football fikstür sorguları bu listeye göre filtrelenir — bkz. `fixtures.ts`.
 */
export const SUPPORTED_LEAGUES: SupportedLeague[] = [
  { id: "ucl", apiFootballId: 2, name: "UEFA Şampiyonlar Ligi", shortName: "UCL" },
  { id: "uel", apiFootballId: 3, name: "UEFA Avrupa Ligi", shortName: "UEL" },
  { id: "uecl", apiFootballId: 848, name: "UEFA Konferans Ligi", shortName: "UECL" },
  { id: "premier-league", apiFootballId: 39, name: "Premier Lig", shortName: "Premier Lig" },
  { id: "la-liga", apiFootballId: 140, name: "LaLiga", shortName: "LaLiga" },
  { id: "serie-a", apiFootballId: 135, name: "Serie A", shortName: "Serie A" },
  { id: "bundesliga", apiFootballId: 78, name: "Bundesliga", shortName: "Bundesliga" },
  { id: "ligue-1", apiFootballId: 61, name: "Ligue 1", shortName: "Ligue 1" },
  { id: "super-lig", apiFootballId: 203, name: "Trendyol Süper Lig", shortName: "Süper Lig" },
  { id: "tff-1-lig", apiFootballId: 204, name: "Trendyol 1. Lig", shortName: "1. Lig" },
];

/** Fikstür listelerine geçmesine izin verilen API-Football `league.id`'leri; diğer ligler atılır. */
export const SUPPORTED_LEAGUE_IDS: readonly number[] = SUPPORTED_LEAGUES.map((league) => league.apiFootballId);

const SUPPORTED_LEAGUE_API_FOOTBALL_IDS = new Set(SUPPORTED_LEAGUE_IDS);

export function isSupportedLeagueId(apiFootballLeagueId: number): boolean {
  return SUPPORTED_LEAGUE_API_FOOTBALL_IDS.has(apiFootballLeagueId);
}

export function getSupportedLeague(id: SupportedLeagueId): SupportedLeague {
  const league = SUPPORTED_LEAGUES.find((l) => l.id === id);
  if (!league) throw new Error(`Bilinmeyen lig: ${id}`);
  return league;
}
