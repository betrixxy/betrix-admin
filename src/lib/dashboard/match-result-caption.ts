import type { MatchResultFacts, ResultTeam } from "@/types/match-result";

/**
 * Maç Sonucu gönderi metni taslağı — şablondan (LLM yok, bkz. CLAUDE.md 1.10): her bilgi gerçek
 * maç verisinden gelir, olmayan satır yazılmaz. Admin inceleme ekranında düzenler.
 */

function scorersLine(team: ResultTeam): string | null {
  if (team.scorers.length === 0) return null;
  return `⚽ ${team.name}: ${team.scorers.map((line) => `${line.name} ${line.minutes.join(", ")}`).join(" · ")}`;
}

export function buildMatchResultCaption(facts: MatchResultFacts, mvpName: string | null): string {
  const penalty = facts.penaltyScore ? ` (P ${facts.penaltyScore})` : "";
  return [
    `MAÇ SONUCU | ${facts.home.name} ${facts.home.goals}-${facts.away.goals} ${facts.away.name}${penalty}`,
    `${facts.competition.name} · ${facts.roundLabel}`,
    scorersLine(facts.home),
    scorersLine(facts.away),
    mvpName ? `⭐ Maçın oyuncusu: ${mvpName}` : null,
  ]
    .filter((line): line is string => line !== null)
    .join("\n");
}

/** Taslak başlığı: "Hoffenheim 2-3 Beşiktaş" (+ penaltılar). */
export function matchResultTitle(facts: MatchResultFacts): string {
  const penalty = facts.penaltyScore ? ` (P ${facts.penaltyScore})` : "";
  return `${facts.home.name} ${facts.home.goals}-${facts.away.goals} ${facts.away.name}${penalty}`;
}
