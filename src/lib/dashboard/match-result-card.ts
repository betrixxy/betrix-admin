import { loadBrandLogo, resolveImage } from "@/lib/dashboard/match-day-assets";
import { upperTr } from "@/lib/dashboard/match-result-labels";
import { resultAccentHex } from "@/lib/dashboard/match-result-theme";
import type { MatchResultCard, MatchResultFacts, ScorerLine } from "@/types/match-result";

/** Kart görselleri — `data:` URI; çözülemeyen `null` (şablon baş harf/boşluk çizer, render düşmez). */
export interface MatchResultImages {
  homeLogo: string | null;
  awayLogo: string | null;
  leagueLogo: string | null;
  brandLogo: string;
}

const upperLines = (lines: ScorerLine[]): ScorerLine[] => lines.map((line) => ({ ...line, name: upperTr(line.name) }));

/** Saf: gerçek maç verisi + seçilen MVP adı → şablon kartı. */
export function buildMatchResultCard(facts: MatchResultFacts, images: MatchResultImages, mvpName: string | null): MatchResultCard {
  return {
    homeTeam: upperTr(facts.home.name),
    awayTeam: upperTr(facts.away.name),
    homeGoals: facts.home.goals,
    awayGoals: facts.away.goals,
    outcome: facts.outcome,
    penaltyLabel: facts.penaltyScore ? `PEN ${facts.penaltyScore}` : null,
    homeScorers: upperLines(facts.home.scorers),
    awayScorers: upperLines(facts.away.scorers),
    competitionLabel: upperTr(facts.competition.name),
    roundLabel: upperTr(facts.roundLabel),
    accentHex: resultAccentHex(facts),
    mvpName: mvpName ? upperTr(mvpName) : null,
    ...images,
  };
}

export async function resolveMatchResultCard(facts: MatchResultFacts, mvpName: string | null): Promise<MatchResultCard> {
  const [homeLogo, awayLogo, leagueLogo, brandLogo] = await Promise.all([
    resolveImage(facts.home.logoUrl, 300),
    resolveImage(facts.away.logoUrl, 300),
    resolveImage(facts.competition.logoUrl || undefined, 200),
    loadBrandLogo(),
  ]);
  return buildMatchResultCard(facts, { homeLogo, awayLogo, leagueLogo, brandLogo }, mvpName);
}
