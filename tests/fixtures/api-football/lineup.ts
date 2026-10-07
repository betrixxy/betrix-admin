import { apiFootballLineupSchema, apiFootballSquadsResponseSchema } from "@/lib/services/api-football/types";

/**
 * Kurgusal API-Football `/fixtures` `lineups` bloğu ve `/players/squads` yanıtı — şema birebir,
 * veri kurgusal. `startXI` bilerek karışık sırada: eşleyici grid'e göre sıralamalı.
 */
const STARTERS: [number, string, number, string][] = [
  [10, "F. Forvet", 9, "5:1"],
  [1, "K. Kaleci", 1, "1:1"],
  [5, "S. Sağbek", 2, "2:4"],
  [2, "S. Solbek", 3, "2:1"],
  [3, "S. Stoper", 4, "2:2"],
  [4, "S. Stoper2", 5, "2:3"],
  [6, "O. Ön", 6, "3:1"],
  [7, "O. Ön2", 8, "3:2"],
  [8, "O. Kanat", 11, "4:1"],
  [9, "O. On", 10, "4:2"],
  [11, "O. Kanat2", 7, "4:3"],
];

export const LINEUP_TEAM_ID = 645;

export const RAW_LINEUP = apiFootballLineupSchema.parse({
  team: { id: LINEUP_TEAM_ID, name: "Kurgu SK", colors: { player: { primary: "E41E2C", number: "ffffff", border: "E41E2C" } } },
  formation: "4-2-3-1",
  coach: { id: 1, name: "T. Direktör" },
  startXI: STARTERS.map(([id, name, number, grid]) => ({ player: { id, name, number, pos: "M", grid } })),
});

export const RAW_SQUADS = apiFootballSquadsResponseSchema.parse({
  response: [
    {
      team: { id: LINEUP_TEAM_ID },
      players: [
        { id: 10, name: "F. Forvet", number: 99, position: "Attacker" },
        { id: 1, name: "K. Kaleci", number: 1, position: "Goalkeeper" },
        { id: 2, name: "S. Solbek", number: 3, position: "Defender" },
        { id: 12, name: "Y. Yedek", number: null, position: "Midfielder" },
        { id: 13, name: null, number: 30, position: "Defender" },
      ],
    },
  ],
});
