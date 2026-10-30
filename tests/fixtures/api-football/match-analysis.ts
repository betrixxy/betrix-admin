import type { ApiFootballHalfTeamStatisticsRaw } from "@/lib/services/api-football/half-stats-types";
import type { ApiFootballFixtureResultRaw } from "@/lib/services/api-football/types";

/**
 * Maç Analizi KURGUSAL maçları (API-Football `/fixtures?id=` şemasında; kişi ve takım adları kurgusal) —
 * kırmızı kart sonrası goller + KK + kaçan penaltı + VAR iptali, uzatmalı (AET) maç ve kalabalık maç (yoğunluk
 * kuralı, uzun Türkçe adlar). Gerçek maç: `match-analysis-real.ts` (Konyaspor 0-4 Galatasaray).
 */

type Side = "H" | "A";
/** [dakika, uzatma, taraf, tür, ayrıntı, oyuncu, asist/giren, yorum] */
export type EventSpec = [number, number | null, Side, string, string, string, (string | undefined)?, (string | undefined)?];

export const KURGU_HOME = { id: 9101, name: "Kuzeyspor" } as const;
export const KURGU_AWAY = { id: 9102, name: "Güneyspor" } as const;

let nextPlayerId = 700_000;
const playerIds = new Map<string, number>();
const idOf = (name: string) => {
  const known = playerIds.get(name);
  if (known) return known;
  nextPlayerId += 1;
  playerIds.set(name, nextPlayerId);
  return nextPlayerId;
};

export function syntheticMatch(input: { id: number; goals: [number, number]; events: EventSpec[]; status?: "FT" | "AET" | "PEN"; penalty?: [number, number]; home?: { id: number; name: string }; away?: { id: number; name: string } }): ApiFootballFixtureResultRaw {
  const home = input.home ?? KURGU_HOME;
  const away = input.away ?? KURGU_AWAY;
  const [h, a] = input.goals;
  const winner = input.penalty ? input.penalty[0] > input.penalty[1] : h > a;
  const draw = !input.penalty && h === a;
  return {
    fixture: { id: input.id, date: "2026-10-25T17:00:00+00:00", timestamp: 1792947600, status: { long: "Match Finished", short: input.status ?? "FT", elapsed: 90 }, referee: null, venue: null },
    league: { id: 203, name: "Süper Lig", country: "Turkey", season: 2026, round: "Regular Season - 9", logo: "" },
    teams: {
      home: { id: home.id, name: home.name, logo: "", winner: draw ? null : winner },
      away: { id: away.id, name: away.name, logo: "", winner: draw ? null : !winner },
    },
    goals: { home: h, away: a },
    score: { penalty: input.penalty ? { home: input.penalty[0], away: input.penalty[1] } : { home: null, away: null } },
    statistics: [],
    players: [],
    lineups: [],
    events: input.events.map(([elapsed, extra, side, type, detail, player, assist, comments]) => ({
      time: { elapsed, extra },
      team: { id: side === "H" ? home.id : away.id },
      player: { id: idOf(player), name: player },
      assist: assist ? { id: idOf(assist), name: assist } : { id: null, name: null },
      type,
      detail,
      comments: comments ?? null,
    })),
  };
}

/**
 * Kuzeyspor 3-1 Güneyspor: 10' ilk gol, 22' eşitlik (P), 30' Güneyspor kırmızı (10 KİŞİ), 38' KK (Güneyspor
 * oyuncusu, Kuzeyspor'a yazılır — kırmızı sonrası), 45+2' sarı, 52' kaçan penaltı, 67' VAR gol iptali (gol
 * sayılmaz), 90+4' fark açan gol (kırılma anı değil).
 */
export const RAW_RED_CARD_MATCH = syntheticMatch({
  id: 990001,
  goals: [3, 1],
  events: [
    [10, null, "H", "Goal", "Normal Goal", "A. Yılmaz", "C. Öztürk"],
    [22, null, "A", "Goal", "Penalty", "K. Demir"],
    [30, null, "A", "Card", "Red Card", "M. Kaya"],
    [38, null, "H", "Goal", "Own Goal", "B. Şahin"],
    [45, 2, "H", "Card", "Yellow Card", "C. Öztürk"],
    [46, null, "A", "subst", "Substitution 1", "T. Uçar", "E. Güler"],
    [52, null, "A", "Goal", "Missed Penalty", "K. Demir"],
    [67, null, "H", "Goal", "Normal Goal", "A. Yılmaz"],
    [67, null, "H", "Var", "Goal cancelled", "A. Yılmaz"],
    [90, 4, "H", "Goal", "Normal Goal", "D. Arslan"],
  ],
});

/** Uzatmalı maç 2-2, penaltılarda 4-3: 45+3', 90+5', 105+1' ve 118' olayları; penaltı atışları çizelgeye girmez. */
export const RAW_EXTRA_TIME_MATCH = syntheticMatch({
  id: 990002,
  goals: [2, 2],
  status: "PEN",
  penalty: [4, 3],
  events: [
    [46, null, "A", "Goal", "Normal Goal", "R. Aksoy"],
    [45, 3, "H", "Card", "Yellow Card", "S. Kılıç"],
    [90, 5, "H", "Goal", "Normal Goal", "O. Çelik"],
    [106, null, "H", "Goal", "Normal Goal", "S. Kılıç"],
    [105, 1, "A", "Card", "Yellow Card", "R. Aksoy"],
    [118, null, "A", "Goal", "Penalty", "R. Aksoy"],
    [120, null, "H", "Goal", "Penalty", "O. Çelik", undefined, "Penalty Shootout"],
    [120, null, "A", "Goal", "Missed Penalty", "R. Aksoy", undefined, "Penalty Shootout"],
  ],
});

const LONG_HOME = ["Muhammed Emin Çağlayangil", "Abdülkerim Bardakçıoğlu", "Oğuzhan Özyakup", "İrfan Can Eğribayatoğlu", "Şükrü Gökdemiroğlu", "Ümit Yıldızoğlu"];
const LONG_AWAY = ["Mohamed-Ali Kouyaté-Diakhaby", "Jean-Philippe Krasniqi", "Aleksandar Đorđević-Petrović", "Konstantinos Papadopoulos", "Ğalip Öztürkmenoğlu", "Çağdaş Şenyüzlüoğlu"];

/**
 * Kalabalık maç (yoğunluk kuralı): 5 gol, 12 değişiklik (aynı dakikada üçlü), 8 sarı, ikinci sarı, kırmızı,
 * 2 VAR — uzun Türkçe ve yabancı adlar. Kuzeyspor 3-2 Güneyspor.
 */
export const RAW_DENSE_MATCH = syntheticMatch({
  id: 990003,
  goals: [3, 2],
  events: [
    [4, null, "A", "Goal", "Normal Goal", LONG_AWAY[0]!],
    [9, null, "H", "Card", "Yellow Card", LONG_HOME[1]!],
    [14, null, "H", "Goal", "Normal Goal", LONG_HOME[0]!],
    [19, null, "A", "Card", "Yellow Card", LONG_AWAY[1]!],
    [27, null, "H", "Var", "Penalty confirmed", LONG_HOME[2]!],
    [28, null, "H", "Goal", "Penalty", LONG_HOME[2]!],
    [33, null, "A", "Card", "Yellow Card", LONG_AWAY[2]!],
    [41, null, "H", "Card", "Yellow Card", LONG_HOME[3]!],
    [45, 4, "A", "Goal", "Normal Goal", LONG_AWAY[3]!],
    [46, null, "H", "subst", "Substitution 1", LONG_HOME[1]!, LONG_HOME[4]!],
    [46, null, "H", "subst", "Substitution 2", LONG_HOME[3]!, LONG_HOME[5]!],
    [46, null, "A", "subst", "Substitution 1", LONG_AWAY[1]!, LONG_AWAY[4]!],
    [55, null, "A", "Card", "Second Yellow card", LONG_AWAY[2]!],
    [58, null, "H", "Card", "Yellow Card", LONG_HOME[4]!],
    [61, null, "A", "subst", "Substitution 2", LONG_AWAY[3]!, LONG_AWAY[5]!],
    [61, null, "A", "subst", "Substitution 3", LONG_AWAY[0]!, "Burak Yılmazoğlu"],
    [61, null, "A", "subst", "Substitution 4", LONG_AWAY[5]!, "Efecan Karaca"],
    [66, null, "H", "Var", "Card reviewed", LONG_HOME[4]!],
    [70, null, "H", "subst", "Substitution 3", LONG_HOME[0]!, "Kerem Aktürkoğlu"],
    [72, null, "A", "Card", "Yellow Card", LONG_AWAY[4]!],
    [77, null, "H", "subst", "Substitution 4", LONG_HOME[2]!, "Arda Güleroğlu"],
    [79, null, "A", "Card", "Red Card", "Efecan Karaca"],
    [81, null, "H", "Card", "Yellow Card", LONG_HOME[5]!],
    [84, null, "A", "subst", "Substitution 5", LONG_AWAY[4]!, "Yusuf Sarıoğlu"],
    [86, null, "H", "subst", "Substitution 5", LONG_HOME[5]!, "Barış Alper Yılmazer"],
    [88, null, "A", "Card", "Yellow Card", "Burak Yılmazoğlu"],
    [90, 3, "H", "Goal", "Normal Goal", "Kerem Aktürkoğlu"],
    [90, 6, "A", "Card", "Yellow Card", "Yusuf Sarıoğlu"],
  ],
});

const stat = (type: string, value: number | string | null) => ({ type, value });

/** Kurgusal devre verisi (API-Football şeması) — `omit`: hiç gelmeyen tipler (satır düşmeli). */
export function syntheticHalves(ids: { home: number; away: number }, values: { possession: [number, number, number, number]; shots: [number, number, number, number]; onTarget: [number, number, number, number]; xg?: [string, string, string, string]; corners: [number, number, number, number] }): ApiFootballHalfTeamStatisticsRaw[] {
  const block = (team: 0 | 1, half: 0 | 1) => {
    const i = half * 2 + team;
    return [
      stat("Ball Possession", `${values.possession[i]}%`),
      stat("Total Shots", values.shots[i] ?? null),
      stat("Shots on Goal", values.onTarget[i] ?? null),
      ...(values.xg ? [stat("expected_goals", values.xg[i] ?? null)] : []),
      stat("Corner Kicks", values.corners[i] ?? null),
    ];
  };
  return [
    { team: { id: ids.home }, statistics: [], statistics_1h: block(0, 0), statistics_2h: block(0, 1) },
    { team: { id: ids.away }, statistics: [], statistics_1h: block(1, 0), statistics_2h: block(1, 1) },
  ];
}
