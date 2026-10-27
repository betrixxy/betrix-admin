import type { DrawState, DrawTeam } from "@/types/draw";

/**
 * Kurgusal kura durumları (bkz. CLAUDE.md 5.2) — takım kimlikleri gerçek API-Football kimlikleri, eşleşmeler
 * uydurma. En kalabalık durum: 16 eşleşmeli eleme turu (C); uzun ad: Borussia Mönchengladbach.
 */

const team = (id: number, apiName: string, country: string, pot: number | null = null): DrawTeam => ({ id, apiName, country, logoUrl: null, pot });

const TEAMS: DrawTeam[] = [
  team(611, "Fenerbahce", "Turkey", 2),
  team(645, "Galatasaray", "Turkey", 2),
  team(549, "Besiktas", "Turkey", 3),
  team(998, "Trabzonspor", "Turkey", 3),
  team(564, "Basaksehir", "Turkey", 4),
  team(163, "Borussia Monchengladbach", "Germany", 1),
  team(211, "Benfica", "Portugal", 1),
  team(530, "Atletico Madrid", "Spain", 1),
  team(40, "Liverpool", "England", 1),
  team(497, "AS Roma", "Italy", 2),
  team(66, "Aston Villa", "England", 2),
  team(560, "Slavia Praha", "Czech-Republic", 3),
  team(550, "Shakhtar Donetsk", "Ukraine", 3),
  team(1393, "Lask Linz", "Austria", 4),
  team(533, "Villarreal", "Spain", 4),
  team(598, "FK Crvena Zvezda", "Serbia", 4),
  team(194, "Ajax", "Netherlands", 1),
  team(212, "FC Porto", "Portugal", 2),
  team(165, "Borussia Dortmund", "Germany", 1),
  team(157, "Bayern Munich", "Germany", 1),
  team(505, "Inter Milan", "Italy", 1),
  team(33, "Manchester United", "England", 1),
  team(85, "Paris Saint Germain", "France", 1),
  team(541, "Real Madrid", "Spain", 1),
  team(529, "Barcelona", "Spain", 1),
  team(50, "Manchester City", "England", 1),
  team(42, "Arsenal", "England", 1),
  team(496, "Juventus", "Italy", 2),
  team(492, "Napoli", "Italy", 2),
  team(499, "Atalanta", "Italy", 2),
  team(228, "Sporting CP", "Portugal", 2),
  team(197, "PSV Eindhoven", "Netherlands", 3),
];

const base = { competition: { id: 2, name: "UEFA Şampiyonlar Ligi" }, season: 2026, drawDateUtc: "2027-02-20T11:00:00Z", teams: TEAMS, nameOverrides: {} };

const ids = TEAMS.map((t) => t.id);
const knockoutTies = Array.from({ length: 16 }, (_, i) => ({ first: ids[i * 2]!, second: ids[i * 2 + 1]!, firstLegUtc: i === 0 ? "2027-03-03T20:00:00Z" : null, secondLegUtc: i === 0 ? "2027-03-10T20:00:00Z" : null }));

/** Son 16 değil "Son 32" düzeni: 16 eşleşme (C'nin en kalabalık hâli). */
export const DRAW_KNOCKOUT: DrawState = { ...base, roundLabel: "Play-off Turu", stage: "KNOCKOUT", ties: knockoutTies, fixtures: [] };

const opponents = [163, 211, 530, 40, 497, 66, 560, 550];
export const DRAW_LEAGUE: DrawState = {
  ...base,
  roundLabel: "Lig Aşaması",
  stage: "LEAGUE_PHASE",
  drawDateUtc: "2026-08-27T16:00:00Z",
  ties: [],
  fixtures: [
    ...opponents.map((opponentId, i) => ({ teamId: 611, opponentId, venue: i % 2 === 0 ? ("HOME" as const) : ("AWAY" as const), dateUtc: i < 4 ? `2026-${String(9 + i).padStart(2, "0")}-1${i}T19:00:00Z` : null })),
    ...[1393, 533, 598, 194, 212, 165, 157, 505].map((opponentId, i) => ({ teamId: 645, opponentId, venue: i % 2 === 0 ? ("AWAY" as const) : ("HOME" as const), dateUtc: null })),
    ...[33, 85, 541, 529, 50, 42, 496, 492].map((opponentId, i) => ({ teamId: 549, opponentId, venue: i % 2 === 0 ? ("HOME" as const) : ("AWAY" as const), dateUtc: null })),
    ...[499, 228, 197, 163, 211, 530, 40, 497].map((opponentId, i) => ({ teamId: 998, opponentId, venue: i % 2 === 0 ? ("HOME" as const) : ("AWAY" as const), dateUtc: null })),
    ...[66, 560, 550, 1393, 533, 598, 194, 212].map((opponentId, i) => ({ teamId: 564, opponentId, venue: i % 2 === 0 ? ("AWAY" as const) : ("HOME" as const), dateUtc: null })),
  ],
};
