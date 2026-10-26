import type { TeamRecentForm } from "@/types/sports";

/**
 * İç tahmin modeli — saf, bağımsız Poisson (bkz. `internal-source.ts`). Varsayımlar açıkça sabit:
 * beklenen gol = takımın attığı ile rakibin yediğinin ortalaması (xG varsa gerçek gol ile 50/50
 * harmanlanır), iç saha katsayısı, λ sınırları, ilk yarı payı. Sürüm değişince `MODEL_VERSION` artar
 * (tahmin kaydında saklanır — karnede hangi modelin tuttuğu ayrılır).
 *
 * Sürümler: "poisson-v1" — xG son 5 maçtan (tüm kulvarlar); "v2-season-xg" — xG bu sezonun lig
 * maçlarından (≥5 maç, yoksa yalnızca gol; girdi `season-xg.ts::modelForm`). Hesap aynı.
 */

export const LEGACY_MODEL_VERSION = "poisson-v1";
export const MODEL_VERSION = "v2-season-xg";
export const HOME_FACTOR = 1.1;
export const AWAY_FACTOR = 0.92;
export const LAMBDA_MIN = 0.2;
export const LAMBDA_MAX = 4;
/** İlk yarının beklenen gol payı. */
export const FIRST_HALF_SHARE = 0.45;
/** Skor matrisi üst sınırı (0..MAX_GOALS); kalan olasılık kütlesi ihmal edilebilir (λ ≤ 4). */
export const MAX_GOALS = 10;
/** Model için gereken asgari son maç örneklemi (her takım). */
export const MIN_MATCHES = 3;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** Takımın maç başı "güç" ortalaması: gol ve (varsa) xG harmanı. */
function blended(goals: number | null, xg: number | null): number | null {
  if (goals === null) return xg;
  return xg === null ? goals : (goals + xg) / 2;
}

export interface ExpectedGoals {
  home: number;
  away: number;
}

/** Yetersiz veri → null (sessiz tahmin yok). */
export function expectedGoals(home: TeamRecentForm, away: TeamRecentForm): ExpectedGoals | null {
  if (home.matchesSampled < MIN_MATCHES || away.matchesSampled < MIN_MATCHES) return null;
  const homeAttack = blended(home.goalsForAvg, home.xgForAvg);
  const homeDefence = blended(home.goalsAgainstAvg, home.xgAgainstAvg);
  const awayAttack = blended(away.goalsForAvg, away.xgForAvg);
  const awayDefence = blended(away.goalsAgainstAvg, away.xgAgainstAvg);
  if (homeAttack === null || homeDefence === null || awayAttack === null || awayDefence === null) return null;
  return {
    home: clamp(((homeAttack + awayDefence) / 2) * HOME_FACTOR, LAMBDA_MIN, LAMBDA_MAX),
    away: clamp(((awayAttack + homeDefence) / 2) * AWAY_FACTOR, LAMBDA_MIN, LAMBDA_MAX),
  };
}

function poissonPmf(lambda: number): number[] {
  const out: number[] = [];
  let p = Math.exp(-lambda);
  for (let k = 0; k <= MAX_GOALS; k += 1) {
    out.push(p);
    p = (p * lambda) / (k + 1);
  }
  return out;
}

/** matrix[h][a] = P(ev h, deplasman a gol). Toplam 1'e normalize edilir (kesilen kuyruk). */
export function scoreMatrix(lambdaHome: number, lambdaAway: number): number[][] {
  const home = poissonPmf(lambdaHome);
  const away = poissonPmf(lambdaAway);
  const matrix = home.map((ph) => away.map((pa) => ph * pa));
  const total = matrix.flat().reduce((sum, value) => sum + value, 0);
  return matrix.map((row) => row.map((value) => value / total));
}

export function sumWhere(matrix: number[][], predicate: (home: number, away: number) => boolean): number {
  let total = 0;
  matrix.forEach((row, home) => row.forEach((p, away) => (predicate(home, away) ? (total += p) : undefined)));
  return total;
}

export interface MatchProbabilities {
  result: { HOME: number; DRAW: number; AWAY: number };
  btts: number;
  goals3plus: number;
  goals4plus: number;
  halfTime: { HOME: number; DRAW: number; AWAY: number };
  /** "{taraf} kazanır ve maçta 3+ gol". */
  combo: { HOME: number; AWAY: number };
  /** Kesin skor olasılıkları (ev-deplasman), azalan. */
  exactScores: { home: number; away: number; probability: number }[];
}

export function matchProbabilities(goals: ExpectedGoals): MatchProbabilities {
  const full = scoreMatrix(goals.home, goals.away);
  const half = scoreMatrix(goals.home * FIRST_HALF_SHARE, goals.away * FIRST_HALF_SHARE);
  const sides = (matrix: number[][]) => ({
    HOME: sumWhere(matrix, (h, a) => h > a),
    DRAW: sumWhere(matrix, (h, a) => h === a),
    AWAY: sumWhere(matrix, (h, a) => h < a),
  });
  return {
    result: sides(full),
    btts: sumWhere(full, (h, a) => h > 0 && a > 0),
    goals3plus: sumWhere(full, (h, a) => h + a >= 3),
    goals4plus: sumWhere(full, (h, a) => h + a >= 4),
    halfTime: sides(half),
    combo: { HOME: sumWhere(full, (h, a) => h > a && h + a >= 3), AWAY: sumWhere(full, (h, a) => a > h && h + a >= 3) },
    exactScores: full
      .flatMap((row, home) => row.map((probability, away) => ({ home, away, probability })))
      .sort((a, b) => b.probability - a.probability),
  };
}
