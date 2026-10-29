import { logoSilhouette } from "@/lib/dashboard/logo-silhouette";
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

const dateFormatter = new Intl.DateTimeFormat("tr-TR", { timeZone: "Europe/Istanbul", day: "2-digit", month: "2-digit", year: "numeric" });

/** "2026-07-23T18:00:00+00:00" → "23.07.2026" (maçın İstanbul günü). */
export function setDateLabel(kickoffUtc: string): string {
  return dateFormatter.format(new Date(kickoffUtc));
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
 * Turnuva logosu → beyaz siluet (bkz. `logo-silhouette.ts`). Set rozeti şeffaf olduğu için koyu
 * renkli logolar (UEFA Avrupa Ligi) koyu zeminde kaybolur; yayın grafiğindeki gibi tek renk beyaz
 * çizilir. Düz zemini temizlenemeyen logo null döner — rozet çizilmez, beyaz kutu asla çıkmaz.
 */
export async function monochromeLogo(dataUri: string | null): Promise<string | null> {
  const base64 = dataUri?.split(",")[1];
  if (!base64) return null;
  try {
    return await logoSilhouette(Buffer.from(base64, "base64"));
  } catch {
    return null;
  }
}

/** Kütüphanedeki şeffaf turnuva logosunun URL'i (yoksa null) — testte/offline'da DB'siz yedek verilir. */
export type LeagueLogoLookup = (leagueId: number) => Promise<string | null>;

/** DB yalnızca çağrıldığında yüklenir: set kartlarını DB'siz çizen testler/scriptler etkilenmez. */
const libraryLeagueLogo: LeagueLogoLookup = async (leagueId) => {
  try {
    const { findLeagueLogoUrl } = await import("@/lib/dashboard/media-library");
    return await findLeagueLogoUrl(leagueId);
  } catch {
    return null;
  }
};

/** Rozet sırası: kütüphanedeki şeffaf PNG → sağlayıcı logosu (gerekirse zemini temizlenir) → rozetsiz. */
async function resolveLeagueLogo(facts: SetFacts, lookup: LeagueLogoLookup): Promise<string | null> {
  const library = await lookup(facts.competition.leagueId);
  const fromLibrary = library ? await monochromeLogo(await resolveImage(library, 200)) : null;
  return fromLibrary ?? monochromeLogo(await resolveImage(facts.competition.logoUrl || undefined, 200));
}

export async function resolveSetImages(facts: SetFacts, leagueLogoLookup: LeagueLogoLookup = libraryLeagueLogo): Promise<SetImages> {
  const [homeLogo, awayLogo, leagueLogo, brandLogo] = await Promise.all([
    resolveImage(facts.home.logoUrl, 300),
    resolveImage(facts.away.logoUrl, 300),
    resolveLeagueLogo(facts, leagueLogoLookup),
    loadBrandLogo(),
  ]);
  return { homeLogo, awayLogo, leagueLogo, brandLogo };
}
