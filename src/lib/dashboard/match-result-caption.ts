import { CONTENT_TAGS, hashtagLine } from "@/lib/dashboard/caption-hashtags";
import type { MatchResultFacts, ResultTeam } from "@/types/match-result";

/**
 * Maç Sonucu gönderi metni taslağı — şablondan (LLM yok, bkz. CLAUDE.md 1.10): her bilgi gerçek
 * maç verisinden gelir, olmayan satır yazılmaz. Sonunda etkileşim sorusu ve 3–5 hashtag (ortak kural
 * `caption-hashtags.ts`; set carousel'i de bu metni kullanır). Admin inceleme ekranında düzenler.
 */

export const RESULT_QUESTION = "Maçın yıldızı sizce kimdi? Yorumlara yazın 👇";

function scorersLine(team: ResultTeam): string | null {
  if (team.scorers.length === 0) return null;
  return `⚽ ${team.name}: ${team.scorers.map((line) => `${line.name} ${line.minutes.join(", ")}`).join(" · ")}`;
}

export function buildMatchResultCaption(facts: MatchResultFacts, mvpName: string | null): string {
  const lines = [
    `MAÇ SONUCU | ${matchResultTitle(facts)}`,
    [facts.competition.name, facts.roundLabel].filter((part) => part.trim().length > 0).join(" · ") || null,
    scorersLine(facts.home),
    scorersLine(facts.away),
    mvpName ? `⭐ Maçın oyuncusu: ${mvpName}` : null,
  ].filter((line): line is string => line !== null);
  const tags = hashtagLine({ names: [facts.home.name, facts.away.name], competitions: [facts.competition.name], type: CONTENT_TAGS.MATCH_RESULT });
  return [...lines, "", RESULT_QUESTION, "", tags].join("\n");
}

/** Taslak başlığı: "Hoffenheim 2-3 Beşiktaş" (+ penaltılar). */
export function matchResultTitle(facts: Pick<MatchResultFacts, "home" | "away" | "penaltyScore">): string {
  const penalty = facts.penaltyScore ? ` (P ${facts.penaltyScore})` : "";
  return `${facts.home.name} ${facts.home.goals}-${facts.away.goals} ${facts.away.name}${penalty}`;
}
