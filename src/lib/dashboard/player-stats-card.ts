import { setDateLabel } from "@/lib/dashboard/checkmatch-set";
import { upperTr } from "@/lib/dashboard/match-result-labels";
import { isSimilarColor } from "@/lib/dashboard/color-math";
import { distinctTeamColor, readableTeamColors, resultAccentHex } from "@/lib/dashboard/match-result-theme";
import { upperCompetition, upperName, upperTeamName, type NameOrigin } from "@/lib/dashboard/name-case";
import { formatNumber } from "@/lib/format/number";
import { POSITION_LABELS } from "@/lib/player-stats/catalog";
import { firstNameOf, shortNameOf } from "@/lib/player-h2h/names";
import { spotlightFact } from "@/lib/player-stats/facts";
import { highlightText, spotlightRows } from "@/lib/player-stats/rows";
import type { MatchResultFacts, MatchSide } from "@/types/match-result";
import type { PlayerCardEntry, PlayerMatchLine, PlayerStatRow, PlayerStatsFacts, SpotlightCard, TopPlayersCard } from "@/types/player-match-stats";

/**
 * Oyuncu İstatistikleri kart alanları (saf): maç künyesi, takım renkleri, büyük harfli adlar, satırlar.
 * Vurgu rengi set kuralıyla AYNI (`resultAccentHex`) — carousel'de 01/02 ile tek renk. Takım rengi (puan
 * çubuğu, tipografik zemin): renk kuralı (`readableTeamColors`), iki takım birbirine benzerse deplasman
 * ikincil rengine geçer, o da yoksa vurgu.
 */

export interface PlayerCardImages {
  homeLogo: string | null;
  awayLogo: string | null;
  brandLogo: string;
  /** Oyuncu kimliği → vesikalık (`data:` URI). */
  portraits?: Map<number, string | null> | undefined;
}

/** Kart adı katmanından (arşiv → Sportmonks → API) gelen adlar; verilmezse sağlayıcı adı. */
export type PlayerNames = Map<number, { name: string; origin: NameOrigin | null }>;

type MatchPart = Pick<MatchResultFacts, "home" | "away" | "outcome" | "competition" | "roundLabel" | "kickoffUtc" | "penaltyScore">;

/** Takım renkleri (puan çubuğu, tipografik zemin) — ortak kaynak; renk yoksa NÖTR (beyaz, ikincisi gümüş). */
export function teamHexes(match: MatchPart): Record<MatchSide, string> {
  const home = readableTeamColors(match.home)[0] ?? "#ffffff";
  return { HOME: home, AWAY: distinctTeamColor(match.away, home) ?? (isSimilarColor(home, "#ffffff") ? "#c9ced6" : "#ffffff") };
}

/** "MILAN 2–4 BOLOGNA" (penaltıda "(PEN 4-3)"). */
export function matchLine(match: MatchPart): string {
  const penalty = match.penaltyScore ? ` (PEN ${match.penaltyScore})` : "";
  return `${upperTeamName(match.home.name, match.home.origin)} ${match.home.goals}–${match.away.goals} ${upperTeamName(match.away.name, match.away.origin)}${penalty}`;
}

/** "SERIE A · 9. HAFTA · 28.10.2026" */
export function metaLine(match: MatchPart): string {
  return [upperCompetition(match.competition.name), upperTr(match.roundLabel), setDateLabel(match.kickoffUtc)].filter(Boolean).join(" · ");
}

export function footnote(rows: PlayerStatRow[]): string {
  return rows.some((row) => row.source === "SPORTMONKS") ? "Puan: API-Football · xG: Sportmonks" : "Puan: API-Football";
}

function entry(line: PlayerMatchLine, match: MatchPart, images: PlayerCardImages, names: PlayerNames | undefined): PlayerCardEntry {
  const team = line.side === "HOME" ? match.home : match.away;
  const named = names?.get(line.playerId);
  return {
    playerId: line.playerId,
    name: upperName(named?.name ?? line.name, named?.origin ?? team.origin?.people),
    teamName: upperTeamName(team.name, team.origin),
    teamHex: teamHexes(match)[line.side],
    teamLogo: line.side === "HOME" ? images.homeLogo : images.awayLogo,
    portrait: images.portraits?.get(line.playerId) ?? null,
    rating: line.rating ?? 0,
    ratingText: line.rating === null ? "–" : formatNumber(line.rating, { decimals: 1 }),
    minutes: line.minutes,
    positionLabel: line.position ? POSITION_LABELS[line.position] : null,
  };
}

const base = (facts: PlayerStatsFacts, images: PlayerCardImages, pageLabel: string | null) => ({
  accentHex: resultAccentHex(facts.match),
  pageLabel,
  matchLine: matchLine(facts.match),
  metaLine: metaLine(facts.match),
  brandLogo: images.brandLogo,
});

/**
 * A'nın adı TAM addan (`player-stats-studio.ts::spotlightFullName`; verilmezse kart adı): ilk ad küçük, soyad
 * büyük (Oyuncu Karşılaştırması kuralı — "van", "de" soyada dahil). Baş harf ("S.") ilk ad satırı olmaz.
 */
export function nameParts(fullName: string): { firstName: string; lastName: string } {
  const first = firstNameOf(fullName);
  return { firstName: /^(\p{L}\.\s*)+$/u.test(first) ? "" : first, lastName: shortNameOf(fullName) };
}

export function buildSpotlightCard(input: { facts: PlayerStatsFacts; line: PlayerMatchLine; images: PlayerCardImages; names?: PlayerNames | undefined; fullName?: { name: string; origin: NameOrigin | null } | undefined; pageLabel: string | null; typographic: boolean }): SpotlightCard {
  const { facts, line } = input;
  const names: PlayerNames = new Map(input.names);
  if (input.fullName) names.set(line.playerId, input.fullName);
  const player = entry(line, facts.match, input.images, names);
  const { firstName, lastName } = nameParts(player.name);
  const { hero, rows } = spotlightRows(line);
  const meta = [player.teamName, player.positionLabel, line.minutes !== null ? `${line.minutes} DK` : null].filter(Boolean).join(" · ");
  return {
    ...base(facts, input.images, input.pageLabel),
    footnote: footnote([...hero, ...rows]),
    player,
    metaRow: meta,
    hero,
    rows,
    fact: spotlightFact(line, facts.lines),
    typographic: input.typographic,
    firstName,
    lastName,
  };
}

export const TOP_PLAYERS_TITLE = "MAÇIN EN İYİLERİ";

export function buildTopPlayersCard(input: { facts: PlayerStatsFacts; lines: PlayerMatchLine[]; images: PlayerCardImages; names?: PlayerNames | undefined; pageLabel: string | null }): TopPlayersCard {
  const rows = input.lines.map((line, index) => ({ ...entry(line, input.facts.match, input.images, input.names), rank: index + 1, highlight: highlightText(line) }));
  const usedXg = input.lines.some((line) => line.xg !== null && highlightText(line).includes("xG"));
  return { ...base(input.facts, input.images, input.pageLabel), footnote: usedXg ? "Puan: API-Football · xG: Sportmonks" : "Puan: API-Football", title: TOP_PLAYERS_TITLE, rows };
}
