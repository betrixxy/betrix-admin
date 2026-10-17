import { loadBrandLogo, resolveImage } from "@/lib/dashboard/match-day-assets";
import { upperTr } from "@/lib/dashboard/match-result-labels";
import { resultAccentHex } from "@/lib/dashboard/match-result-theme";
import type { SetCard } from "@/types/checkmatch-set";
import type { MatchResultFacts, ScorerLine } from "@/types/match-result";

/**
 * "CheckMatch set" kart alanları — TEK KAYNAK. Maç Sonucu ve İstatistik kartı skoru, golcüleri,
 * turnuvayı ve vurgu rengini buradan alır; iki kart aynı `MatchResultFacts` alt kümesinden
 * (API-Football, `toMatchResultFacts`) beslendiği için set içinde skor/golcü farkı olamaz.
 */

/** Set kartının okuduğu maç alanları — `MatchResultFacts` ve `MatchStatsFacts` bu şekle uyar. */
export type SetFacts = Pick<MatchResultFacts, "home" | "away" | "outcome" | "penaltyScore" | "competition" | "roundLabel">;

/** Kart görselleri — `data:` URI; çözülemeyen `null` (şablon baş harf/boşluk çizer, render düşmez). */
export interface SetImages {
  homeLogo: string | null;
  awayLogo: string | null;
  leagueLogo: string | null;
  brandLogo: string;
}

const upperLines = (lines: ScorerLine[]): ScorerLine[] => lines.map((line) => ({ ...line, name: upperTr(line.name) }));

/** Saf: maç verisi + görseller + sayfa etiketi → set alanları. */
export function buildSetCard(facts: SetFacts, images: SetImages, pageLabel: string | null): SetCard {
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
    pageLabel,
    ...images,
  };
}

export async function resolveSetImages(facts: SetFacts): Promise<SetImages> {
  const [homeLogo, awayLogo, leagueLogo, brandLogo] = await Promise.all([
    resolveImage(facts.home.logoUrl, 300),
    resolveImage(facts.away.logoUrl, 300),
    resolveImage(facts.competition.logoUrl || undefined, 200),
    loadBrandLogo(),
  ]);
  return { homeLogo, awayLogo, leagueLogo, brandLogo };
}
