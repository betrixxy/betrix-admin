import { COMPETITION_NAMES } from "@/lib/names/competition-names";

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
  /** Kart adı — `lib/names/competition-names.ts` (tek kaynak). */
  name: string;
  /** Arayüz kısaltması (Maç Merkezi satırı, etiket: "UCL") — kartta kullanılmaz. */
  shortName: string;
  /**
   * Takım adlarının varsayılan büyük harf kökeni (bkz. `name-case.ts`): Türk liglerinde tr, diğerlerinde
   * intl. Avrupa kupalarında intl — Türk kulüpleri adlarındaki işaretle (ş, ğ, ı, "-spor") Türkçe kalır.
   */
  nameOrigin: "tr" | "intl";
}

const cardName = (apiFootballId: number): string => COMPETITION_NAMES[apiFootballId]?.name ?? String(apiFootballId);
const cardShort = (apiFootballId: number): string => COMPETITION_NAMES[apiFootballId]?.short ?? String(apiFootballId);

/**
 * Stüdyo'nun/Takvim'in kapsadığı sabit lig listesi (bkz. kullanıcının referans görseli).
 * API-Football fikstür sorguları bu listeye göre filtrelenir — bkz. `fixtures.ts`.
 */

export const SUPPORTED_LEAGUES: SupportedLeague[] = [
  { id: "ucl", apiFootballId: 2, name: cardName(2), shortName: "UCL", nameOrigin: "intl" },
  { id: "uel", apiFootballId: 3, name: cardName(3), shortName: "UEL", nameOrigin: "intl" },
  { id: "uecl", apiFootballId: 848, name: cardName(848), shortName: "UECL", nameOrigin: "intl" },
  { id: "premier-league", apiFootballId: 39, name: cardName(39), shortName: cardShort(39), nameOrigin: "intl" },
  { id: "la-liga", apiFootballId: 140, name: cardName(140), shortName: cardShort(140), nameOrigin: "intl" },
  { id: "serie-a", apiFootballId: 135, name: cardName(135), shortName: cardShort(135), nameOrigin: "intl" },
  { id: "bundesliga", apiFootballId: 78, name: cardName(78), shortName: cardShort(78), nameOrigin: "intl" },
  { id: "ligue-1", apiFootballId: 61, name: cardName(61), shortName: cardShort(61), nameOrigin: "intl" },
  { id: "super-lig", apiFootballId: 203, name: cardName(203), shortName: cardShort(203), nameOrigin: "tr" },
  { id: "tff-1-lig", apiFootballId: 204, name: cardName(204), shortName: cardShort(204), nameOrigin: "tr" },
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
