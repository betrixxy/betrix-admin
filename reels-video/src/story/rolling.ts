import { seeded } from "../lib/motion";

export interface RollingScore {
  home: number;
  away: number;
  winner: "home" | "draw" | "away";
}

/**
 * Kanca sahnesinde dönen skorlar: sonucu maçın gerçek olasılıklarına göre çekilir, tablo modelin söylediğinden başka
 * bir dengeye işaret etmez. Skorun kendisi görseldir, tek tek olasılık iddiası taşımaz.
 */
export function rollingScore(seed: number, shares: { home: number; draw: number; away: number }): RollingScore {
  const total = shares.home + shares.draw + shares.away;
  const pick = seeded(seed) * total;
  const winner = pick < shares.home ? "home" : pick < shares.home + shares.draw ? "draw" : "away";
  const base = Math.floor(seeded(seed + 7) * 2.6);
  if (winner === "draw") return { home: base, away: base, winner };
  const margin = 1 + Math.floor(seeded(seed + 13) ** 2 * 3);
  return winner === "home" ? { home: base + margin, away: base, winner } : { home: base, away: base + margin, winner };
}
