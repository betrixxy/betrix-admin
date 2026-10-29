import { fullDate } from "@/lib/format/dates";
import { loadBrandLogo, resolveImage } from "@/lib/dashboard/match-day-assets";
import { upperTr } from "@/lib/dashboard/match-result-labels";
import { upperName, upperTeamName, type TeamOrigin } from "@/lib/dashboard/name-case";
import { resultAccentHex } from "@/lib/dashboard/match-result-theme";
import type { SetCard } from "@/types/checkmatch-set";
import type { MatchResultFacts, ScorerLine } from "@/types/match-result";

/**
 * "CheckMatch set" kart alanları — TEK KAYNAK. Maç Sonucu ve İstatistik kartı skoru, golcüleri,
 * turnuvayı ve vurgu rengini buradan alır; iki kart aynı `MatchResultFacts` alt kümesinden
 * (API-Football, `toMatchResultFacts`) beslendiği için set içinde skor/golcü farkı olamaz.
 */

/** Set kartının okuduğu maç alanları — `MatchResultFacts` ve `MatchStatsFacts` bu şekle uyar. */
export type SetFacts = Pick<MatchResultFacts, "home" | "away" | "outcome" | "penaltyScore" | "competition" | "roundLabel" | "kickoffUtc">;


/** "2026-07-23T18:00:00+00:00" → "23.07.2026" (maçın İstanbul günü). */
export function setDateLabel(kickoffUtc: string): string {
  return fullDate(kickoffUtc);
}

/** Kart görselleri — `data:` URI; çözülemeyen `null` (şablon baş harf/boşluk çizer, render düşmez). */
export interface SetImages {
  homeLogo: string | null;
  awayLogo: string | null;
  leagueLogo: string | null;
  brandLogo: string;
}

/** Golcü adları: kendi harfleri, belirsizse takımın kişi kökeni (kendi kalesine gol nadir istisna). */
const upperLines = (lines: ScorerLine[], origin: TeamOrigin | undefined): ScorerLine[] => lines.map((line) => ({ ...line, name: upperName(line.name, line.origin ?? origin?.people) }));

/** Saf: maç verisi + görseller + sayfa etiketi → set alanları. */
export function buildSetCard(facts: SetFacts, images: SetImages, pageLabel: string | null): SetCard {
  return {
    homeTeam: upperTeamName(facts.home.name, facts.home.origin),
    awayTeam: upperTeamName(facts.away.name, facts.away.origin),
    homeGoals: facts.home.goals,
    awayGoals: facts.away.goals,
    outcome: facts.outcome,
    penaltyLabel: facts.penaltyScore ? `PEN ${facts.penaltyScore}` : null,
    homeScorers: upperLines(facts.home.scorers, facts.home.origin),
    awayScorers: upperLines(facts.away.scorers, facts.away.origin),
    competitionLabel: upperTr(facts.competition.name),
    roundLabel: upperTr(facts.roundLabel),
    accentHex: resultAccentHex(facts),
    pageLabel,
    dateLabel: setDateLabel(facts.kickoffUtc),
    ...images,
  };
}

/**
 * Lig/turnuva logosu hiçbir kartta kullanılmaz (kurucu kararı, Kura ile tutarlı — 2026-10-29): turnuva adı
 * tipografik yazılır (künye satırı), rozet yerine vurgu çizgisi çizilir. `leagueLogo` her zaman null.
 */
export async function resolveSetImages(facts: SetFacts): Promise<SetImages> {
  const [homeLogo, awayLogo, brandLogo] = await Promise.all([resolveImage(facts.home.logoUrl, 300), resolveImage(facts.away.logoUrl, 300), loadBrandLogo()]);
  return { homeLogo, awayLogo, leagueLogo: null, brandLogo };
}
