import type { ApiFootballFixtureDetailRaw } from "@/lib/services/api-football/types";
import type { TeamDeepStats } from "@/types/deep-analysis";

/**
 * Derin analizin ileri metrikleri — API-Football maç + oyuncu istatistiklerinden, saf fonksiyon
 * (bkz. CLAUDE.md 1.4). Oranlar "toplamların oranı" ile hesaplanır (maç oranlarının ortalaması
 * değil): az şutlu bir maç dönüşüm oranını çarpıtmasın. Bir metriğin girdisi hiçbir maçta yoksa
 * sonuç `null` — sıfır uydurulmaz.
 */

export type AdvancedMetrics = Pick<
  TeamDeepStats,
  | "shotsAvg"
  | "shotsConcededAvg"
  | "shotsInsideBoxPct"
  | "shotAccuracyPct"
  | "conversionPct"
  | "xgPerShot"
  | "keyPassesAvg"
  | "dribbleSuccessPct"
  | "ppdaFullPitch"
>;

function toNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const numeric = typeof value === "number" ? value : Number.parseFloat(value.replace("%", ""));
  return Number.isFinite(numeric) ? numeric : null;
}

function stat(raw: ApiFootballFixtureDetailRaw, teamId: number, type: string): number | null {
  const row = raw.statistics.find((entry) => entry.team.id === teamId);
  return toNumber(row?.statistics.find((entry) => entry.type === type)?.value);
}

/** Pay/payda çiftlerini biriktirir; payda sıfırsa oran yoktur. */
class Ratio {
  private num = 0;
  private den = 0;
  private samples = 0;
  add(num: number, den: number): void {
    this.num += num;
    this.den += den;
    this.samples += 1;
  }
  value(scale = 1): number | null {
    return this.samples > 0 && this.den > 0 ? (this.num / this.den) * scale : null;
  }
}

function playerTotals(raw: ApiFootballFixtureDetailRaw, teamId: number) {
  const players = raw.players.find((entry) => entry.team.id === teamId)?.players ?? [];
  if (players.length === 0) return null;
  const totals = { keyPasses: 0, defensiveActions: 0, dribbleAttempts: 0, dribbleSuccess: 0 };
  for (const { statistics } of players) {
    const s = statistics[0];
    totals.keyPasses += s?.passes?.key ?? 0;
    totals.defensiveActions += (s?.tackles?.total ?? 0) + (s?.tackles?.interceptions ?? 0);
    totals.dribbleAttempts += s?.dribbles?.attempts ?? 0;
    totals.dribbleSuccess += s?.dribbles?.success ?? 0;
  }
  return totals;
}

export function computeAdvancedMetrics(fixtures: ApiFootballFixtureDetailRaw[], teamId: number): AdvancedMetrics {
  const shots = new Ratio(); // şut / maç
  const conceded = new Ratio();
  const insideBox = new Ratio();
  const accuracy = new Ratio();
  const conversion = new Ratio();
  const xgPerShot = new Ratio();
  const keyPasses = new Ratio();
  const dribbles = new Ratio();
  const ppda = new Ratio();

  for (const raw of fixtures) {
    const opponentId = raw.teams.home.id === teamId ? raw.teams.away.id : raw.teams.home.id;
    const total = stat(raw, teamId, "Total Shots");
    const onTarget = stat(raw, teamId, "Shots on Goal");
    const inside = stat(raw, teamId, "Shots insidebox");
    const xg = stat(raw, teamId, "expected_goals");
    const opponentShots = stat(raw, opponentId, "Total Shots");
    const goals = raw.teams.home.id === teamId ? raw.goals.home : raw.goals.away;

    if (total !== null) {
      shots.add(total, 1);
      if (inside !== null) insideBox.add(inside, total);
      if (onTarget !== null) accuracy.add(onTarget, total);
      if (goals !== null) conversion.add(goals, total);
      if (xg !== null) xgPerShot.add(xg, total);
    }
    if (opponentShots !== null) conceded.add(opponentShots, 1);

    const players = playerTotals(raw, teamId);
    if (players) {
      keyPasses.add(players.keyPasses, 1);
      if (players.dribbleAttempts > 0) dribbles.add(players.dribbleSuccess, players.dribbleAttempts);
      const opponentPasses = stat(raw, opponentId, "Total passes");
      const fouls = stat(raw, teamId, "Fouls");
      if (opponentPasses !== null && fouls !== null) ppda.add(opponentPasses, players.defensiveActions + fouls);
    }
  }

  return {
    shotsAvg: shots.value(),
    shotsConcededAvg: conceded.value(),
    shotsInsideBoxPct: insideBox.value(100),
    shotAccuracyPct: accuracy.value(100),
    conversionPct: conversion.value(100),
    xgPerShot: xgPerShot.value(),
    keyPassesAvg: keyPasses.value(),
    dribbleSuccessPct: dribbles.value(100),
    ppdaFullPitch: ppda.value(),
  };
}
