import { type Reason, claim, claims, say, TEAM, type VoiceLine } from "./claims";
import type { MatchData, Side } from "./match-data";

/**
 * "Neden?" maddeleri: soru sahnelerinin rakamını futbol verisiyle açıklar. Ekranda rakam + en fazla 8 sözcük; anlatımı
 * seslendirme yapar. Bağlam yoksa boş döner; sahne yine çalışır.
 */

const team = (side: Side, path: string): string => `context.teams.${side}.${path}`;
const early = (side: Side, kind: "for" | "against") => [team(side, `minutes.${kind}.0`), team(side, `minutes.${kind}.1`)];

export function goalsReasons(data: MatchData): Reason[] {
  return claims([
    claim(data, "goals.home", "{home}: maç başına {forAvg} gol atıyor", { home: TEAM.home, forAvg: { key: team("home", "goals_for_avg"), format: "dec1" } }),
    claim(data, "goals.away", "{away}: maç başına {againstAvg} gol yiyor", { away: TEAM.away, againstAvg: { key: team("away", "goals_against_avg"), format: "dec1" } }),
  ]);
}

export function goalsVoice(data: MatchData): (VoiceLine | null)[] {
  return [
    say(data, "goals.hero", "En az üç gol {p}.", { p: { key: "goals.three_plus", format: "prob" } }),
    say(data, "goals.why", "{home} maçta {a} atıyor, {away} {b} yiyor.", { home: TEAM.home, away: TEAM.away, a: { key: team("home", "goals_for_avg"), format: "dec1" }, b: { key: team("away", "goals_against_avg"), format: "dec1" } }),
  ];
}

export function bothScoreReasons(data: MatchData): Reason[] {
  return claims([
    claim(data, "both.home", "{home}: maçların {fail} gol bulamadı", { home: TEAM.home, fail: { key: team("home", "failed_to_score_pct"), format: "pctIn" } }),
    claim(data, "both.away", "{away}: maçların {clean} gol yemedi", { away: TEAM.away, clean: { key: team("away", "clean_sheet_pct"), format: "pctIn" } }),
  ]);
}

export function bothScoreVoice(data: MatchData): (VoiceLine | null)[] {
  return [
    say(data, "both.hero", "İkisinin de gol bulması {p}.", { p: { key: "both_score", format: "prob" } }),
    say(data, "both.why", "{home} {fail} golsüz, {away} {clean} gol yemedi.", { home: TEAM.home, away: TEAM.away, fail: { key: team("home", "failed_to_score_pct"), format: "pctIn" }, clean: { key: team("away", "clean_sheet_pct"), format: "pctIn" } }),
  ];
}

export function firstGoalReasons(data: MatchData): Reason[] {
  return claims([
    claim(data, "first.early", "İlk yarım saat: {home} {homeFor} gol attı", { home: TEAM.home, homeFor: { keys: early("home", "for"), op: "sum", format: "int" } }),
    claim(data, "first.conceded", "İlk yarım saat: {away} {awayFor} gol attı", { away: TEAM.away, awayFor: { keys: early("away", "for"), op: "sum", format: "int" } }),
  ]);
}

export function firstGoalVoice(data: MatchData, lead: Side): (VoiceLine | null)[] {
  return [
    say(data, "first.hero", "İlk golde {lead} önde: {p}.", { lead: TEAM[lead], p: { key: `first_goal.${lead}`, format: "prob" } }),
    say(data, "first.why", "İlk yarım saatte {home} {a}, {away} {b} gol attı.", { home: TEAM.home, away: TEAM.away, a: { keys: early("home", "for"), op: "sum", format: "int" }, b: { keys: early("away", "for"), op: "sum", format: "int" } }),
  ];
}
