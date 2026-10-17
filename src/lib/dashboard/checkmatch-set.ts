import sharp from "sharp";
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
    dateLabel: setDateLabel(facts.kickoffUtc),
    ...images,
  };
}

/** Şeffaf alanı bundan azsa logo düz zeminlidir (JPEG vb.) — beyaz siluet kutuya dönüşür, orijinal kullanılır. */
const MIN_TRANSPARENT_SHARE = 0.1;

/**
 * Turnuva logosu → beyaz siluet (alfa kanalından). Set rozeti şeffaf olduğu için koyu renkli
 * logolar (UEFA Avrupa Ligi) koyu zeminde kaybolur; yayın grafiğindeki gibi tek renk beyaz çizilir.
 */
export async function monochromeLogo(dataUri: string | null): Promise<string | null> {
  if (!dataUri) return null;
  const base64 = dataUri.split(",")[1];
  if (!base64) return dataUri;
  try {
    const image = sharp(Buffer.from(base64, "base64")).ensureAlpha();
    const alpha = await image.clone().extractChannel(3).raw().toBuffer({ resolveWithObject: true });
    const transparent = alpha.data.reduce((count, value) => count + (value < 16 ? 1 : 0), 0) / alpha.data.length;
    if (transparent < MIN_TRANSPARENT_SHARE) return dataUri;
    const { width, height } = alpha.info;
    const white = await sharp({ create: { width, height, channels: 3, background: { r: 255, g: 255, b: 255 } } })
      .joinChannel(alpha.data, { raw: { width, height, channels: 1 } })
      .png()
      .toBuffer();
    return `data:image/png;base64,${white.toString("base64")}`;
  } catch {
    return dataUri;
  }
}

export async function resolveSetImages(facts: SetFacts): Promise<SetImages> {
  const [homeLogo, awayLogo, leagueLogo, brandLogo] = await Promise.all([
    resolveImage(facts.home.logoUrl, 300),
    resolveImage(facts.away.logoUrl, 300),
    resolveImage(facts.competition.logoUrl || undefined, 200).then(monochromeLogo),
    loadBrandLogo(),
  ]);
  return { homeLogo, awayLogo, leagueLogo, brandLogo };
}
