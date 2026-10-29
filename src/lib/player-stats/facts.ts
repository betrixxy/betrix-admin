import type { PlayerMatchLine, PlayerMatchNumbers, PlayerPosition } from "@/types/player-match-stats";

/**
 * A kartının tek satır olgusu — KURAL TABANLI (saf; yorum, sıfat, bahis dili yok). Sıra:
 *   1. ≥ 2 gol ve şut sayısı biliniyor → "4 şutta 3 gol" (3 golde "Hat-trick · " öneki).
 *   2. Maçın tek lideri (iki takımın süre alan bütün oyuncuları içinde, en az 3) → "Maçın en çok top kesen oyuncusu (4)".
 *   3. Kaleci, 90 dk, yenilen gol 0 (veri varsa) → "Gol yemedi · 5 kurtarış".
 *   4. ≥ 30 pas, isabet ≥ %90 → "54 pasta %93 isabet".
 * Hiçbiri yoksa null (olgu satırı çizilmez). Eksik veri (null) hiçbir kuralı tetiklemez.
 */

type Category = { key: keyof PlayerMatchNumbers; text: string };

const LEADER: Record<PlayerPosition, Category[]> = {
  F: [
    { key: "shotsTotal", text: "en çok şut çeken" },
    { key: "dribblesSuccess", text: "en çok başarılı dripling yapan" },
    { key: "keyPasses", text: "en çok kilit pas veren" },
    { key: "duelsWon", text: "en çok ikili mücadele kazanan" },
  ],
  M: [
    { key: "keyPasses", text: "en çok kilit pas veren" },
    { key: "dribblesSuccess", text: "en çok başarılı dripling yapan" },
    { key: "interceptions", text: "en çok top kesen" },
    { key: "tackles", text: "en çok top çalan" },
    { key: "duelsWon", text: "en çok ikili mücadele kazanan" },
  ],
  D: [
    { key: "interceptions", text: "en çok top kesen" },
    { key: "tackles", text: "en çok top çalan" },
    { key: "duelsWon", text: "en çok ikili mücadele kazanan" },
    { key: "blocks", text: "en çok blok yapan" },
  ],
  G: [{ key: "saves", text: "en çok kurtarış yapan" }],
};

const LEADER_MIN = 3;

/** Oyuncu bu kategoride maçın TEK lideri mi (eşitlik lider saymaz). */
function uniqueLeader(line: PlayerMatchLine, all: PlayerMatchLine[], key: keyof PlayerMatchNumbers): number | null {
  const value = line.numbers[key];
  if (value === null || value < LEADER_MIN) return null;
  const others = all.filter((other) => other.playerId !== line.playerId).map((other) => other.numbers[key] ?? -1);
  return others.every((other) => other < value) ? value : null;
}

export function spotlightFact(line: PlayerMatchLine, all: PlayerMatchLine[]): string | null {
  const n = line.numbers;
  if (n.goals !== null && n.goals >= 2 && n.shotsTotal !== null && n.shotsTotal >= n.goals) {
    return `${n.goals === 3 ? "Hat-trick · " : ""}${n.shotsTotal} şutta ${n.goals} gol`;
  }
  for (const category of LEADER[line.position ?? "M"]) {
    const value = uniqueLeader(line, all, category.key);
    if (value !== null) return `Maçın ${category.text} oyuncusu (${value})`;
  }
  if (line.position === "G" && (line.minutes ?? 0) >= 90 && n.conceded === 0) return n.saves !== null ? `Gol yemedi · ${n.saves} kurtarış` : "Gol yemedi";
  if (n.passesTotal !== null && n.passesAccurate !== null && n.passesTotal >= 30 && n.passesAccurate <= n.passesTotal) {
    const pct = Math.round((n.passesAccurate / n.passesTotal) * 100);
    if (pct >= 90) return `${n.passesTotal} pasta %${pct} isabet`;
  }
  return null;
}
