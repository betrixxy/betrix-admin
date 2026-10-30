import { clubColorSource, clubColors } from "@/lib/dashboard/club-colors";
import { CARD_SHADE_HEX, isHex, isSimilarColor, liftLightness } from "@/lib/dashboard/color-math";
import type { CompetitionKind, MatchResultFacts, ResultTeam } from "@/types/match-result";

export { contrastRatio } from "@/lib/dashboard/color-math";

/**
 * Maç Sonucu tek vurgu rengi: Avrupa turnuvasında turnuva rengi, yurt içinde kazanan takımın
 * rengi (beraberlikte ev sahibi). Takım rengi koyu zeminde okunmuyorsa tonu korunarak açılır
 * (`liftLightness`); yine okunmuyorsa ya da rakibin rengine benziyorsa (iki kırmızı) takımın
 * ikincil rengine geçilir — Gençlerbirliği 0-1 Galatasaray'da vurgu Galatasaray altınıdır.
 * Maç İstatistikleri takım renkleri aynı kuralı kullanır (`match-stats-theme.ts`).
 */

/** Turnuva kimlik renkleri: `accent` yazı/çizgi vurgusu, `deep` çerçeve/zemin tonu. */
export const COMPETITION_COLORS: Partial<Record<CompetitionKind, { accent: string; deep: string }>> = {
  UCL: { accent: "#C8D2E0", deep: "#0B1F4F" }, // lacivert / gümüş
  UEL: { accent: "#FF6B00", deep: "#2B1300" }, // turuncu
  UECL: { accent: "#00C25A", deep: "#06291A" }, // yeşil
};

/** Takım rengi yoksa NÖTR beyaz (kurucu kararı 2026-10-30: asla altın/marka rengi); rakip de beyazsa gümüş. */
const FALLBACK_ACCENT = "#ffffff";
const FALLBACK_SILVER = "#c9ced6";
/** Kartın koyu gradyan zemini — kontrast bu renge göre ölçülür. */
export const RESULT_SHADE_HEX = CARD_SHADE_HEX;

/** Kulübün kimlik rengi (elle tutulan tablo, bkz. `club-colors.ts`); tabloda yoksa boş. */
export function teamColorHex(teamId: number): string {
  return clubColors(teamId)?.primary ?? "";
}

/**
 * Takımın koyu zeminde okunur renk adayları, öncelik sırasıyla: birincil → o maçın forma rengi → ikincil. Birincil:
 * tablodaki takımda `colorHex` (eşleyici tablo rengini yazar), tablo dışında onaylı/otomatik logo rengi (`club-colors.ts`).
 */
export function readableTeamColors(team: Pick<ResultTeam, "id" | "colorHex">): string[] {
  const club = clubColors(team.id);
  const primary = clubColorSource(team.id) === "TABLE" ? team.colorHex : (club?.primary ?? team.colorHex);
  const candidates = [primary, team.colorHex, club?.secondary];
  const readable = candidates.filter(isHex).map((hex) => liftLightness(hex)).filter((hex): hex is string => hex !== null);
  return [...new Set(readable)];
}

/** Rakibin rengine benzemeyen ilk okunur aday; hepsi benziyorsa null. */
export function distinctTeamColor(team: Pick<ResultTeam, "id" | "colorHex">, rival: string | null): string | null {
  const candidates = readableTeamColors(team);
  return candidates.find((hex) => !rival || !isSimilarColor(hex, rival)) ?? null;
}

/** İki takımın kart rengi (ortak kaynak) — kulüp rengi yoksa nötr beyaz; ikinci takım birinciye benzerse ikincil, o da yoksa gümüş. */
export function teamPairColors(homeId: number, awayId: number): [string, string] {
  const home = readableTeamColors({ id: homeId, colorHex: teamColorHex(homeId) })[0] ?? FALLBACK_ACCENT;
  const away = distinctTeamColor({ id: awayId, colorHex: teamColorHex(awayId) }, home) ?? (isSimilarColor(home, FALLBACK_ACCENT) ? FALLBACK_SILVER : FALLBACK_ACCENT);
  return [home, away];
}

export function resultAccentHex(facts: Pick<MatchResultFacts, "competition" | "outcome" | "home" | "away">): string {
  const competition = COMPETITION_COLORS[facts.competition.kind];
  if (competition) return competition.accent;
  const [winner, other] = facts.outcome === "AWAY" ? [facts.away, facts.home] : [facts.home, facts.away];
  const rival = readableTeamColors(other)[0] ?? null;
  return distinctTeamColor(winner, rival) ?? (rival && isSimilarColor(FALLBACK_ACCENT, rival) ? FALLBACK_SILVER : FALLBACK_ACCENT);
}
