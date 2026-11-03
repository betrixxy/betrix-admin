import { type Reason, claim, claims, TEAM } from "./claims";
import type { MatchData, Side } from "./match-data";

/** "Neden?" maddeleri: soru sahnelerinin rakamını futbol verisiyle açıklar. Bağlam yoksa boş döner; sahne yine çalışır. */

const team = (side: Side, path: string): string => `context.teams.${side}.${path}`;

export function goalsReasons(data: MatchData): Reason[] {
  return claims([
    claim(data, "goals.home", "{home} maç başına {forAvg} gol atıyor, {away} {againstAvg} gol yiyor.", { home: TEAM.home, away: TEAM.away, forAvg: { key: team("home", "goals_for_avg"), format: "dec1" }, againstAvg: { key: team("away", "goals_against_avg"), format: "dec1" } }),
    claim(data, "goals.away", "{away} maç başına {forAvg} gol atıyor, {home} {againstAvg} gol yiyor.", { home: TEAM.home, away: TEAM.away, forAvg: { key: team("away", "goals_for_avg"), format: "dec1" }, againstAvg: { key: team("home", "goals_against_avg"), format: "dec1" } }),
  ]);
}

export function bothScoreReasons(data: MatchData): Reason[] {
  return claims([
    claim(data, "both.home", "{home} maçların {fail} gol bulamadı. {away} maçların {clean} kalesini gole kapattı.", { home: TEAM.home, away: TEAM.away, fail: { key: team("home", "failed_to_score_pct"), format: "pctIn" }, clean: { key: team("away", "clean_sheet_pct"), format: "pctIn" } }),
    claim(data, "both.away", "{away} maçların {fail} gol bulamadı. {home} maçların {clean} kalesini gole kapattı.", { home: TEAM.home, away: TEAM.away, fail: { key: team("away", "failed_to_score_pct"), format: "pctIn" }, clean: { key: team("home", "clean_sheet_pct"), format: "pctIn" } }),
  ]);
}

export function firstGoalReasons(data: MatchData): Reason[] {
  const early = (side: Side, kind: "for" | "against") => [team(side, `minutes.${kind}.0`), team(side, `minutes.${kind}.1`)];
  return claims([
    claim(data, "first.early", "İlk yarım saatte {home} {homeFor} gol attı, {away} {awayFor} gol attı.", { home: TEAM.home, away: TEAM.away, homeFor: { keys: early("home", "for"), op: "sum", format: "int" }, awayFor: { keys: early("away", "for"), op: "sum", format: "int" } }),
    claim(data, "first.conceded", "Aynı dilimde {home} {homeAgainst} gol yedi, {away} {awayAgainst} gol yedi.", { home: TEAM.home, away: TEAM.away, homeAgainst: { keys: early("home", "against"), op: "sum", format: "int" }, awayAgainst: { keys: early("away", "against"), op: "sum", format: "int" } }),
  ]);
}
