import { setDateLabel } from "@/lib/dashboard/checkmatch-set";
import { cardTeamColor } from "@/lib/dashboard/vitrin-card";
import { isSimilarColor } from "@/lib/dashboard/color-math";
import type { MatchDayFrame } from "@/lib/dashboard/match-day-formats";
import { upperTr } from "@/lib/dashboard/match-result-labels";
import { upperName, type NameOrigin } from "@/lib/dashboard/name-case";
import { comparisonPosition, comparisonWarnings, freshnessLabel, scopeLabel } from "@/lib/player-h2h/checks";
import { factLine } from "@/lib/player-h2h/facts";
import { firstNameOf } from "@/lib/player-h2h/names";
import { buildHero, buildRows, groupRows } from "@/lib/player-h2h/rows";
import { MAX_ROWS, POSITION_LABELS } from "@/lib/player-h2h/stats";
import { numberPossessive } from "@/lib/player-h2h/turkish";
import { bannedWordsGate } from "@/lib/prediction/banned-words";
import { chartRowHeight, h2hCompareGeometry } from "@/skills/render-engine/templates/player-h2h/geometry";
import type { H2HCard, H2HDropped, H2HMode, H2HPlayerCard, H2HPosition, H2HRow, PlayerSeasonStats } from "@/types/player-h2h";
import type { Result } from "@/types/result";

/**
 * Oyuncu karşılaştırma kartının alanları — saf, TEK KAYNAK (motor, offline script, görsel test).
 * Renk kuralı vitrinle aynı (`cardTeamColor`: ana renk koyu zeminde okunmuyorsa ikincil); aynı
 * takımdan iki oyuncu ya da çakışan renkler: sağdaki oyuncu nötr renge geçer. Satır sayısı formatın
 * grafik kapasitesine göre (sığmayan düşük öncelikliler düşer).
 */

export const H2H_PAGE_LABELS: [string, string] = ["01 · KARŞILAŞTIRMA", "02 · İSTATİSTİKLER"];
const NEUTRALS = ["#E8E8EA", "#9AA3B5"] as const;
export const XG_NOTE = "xG: Pozisyonların gole dönme ihtimali.";
export const XA_NOTE = "xA: Pasın gol asistine dönme ihtimali.";

/** [sol, sağ] renk: sağ, sol ile aynı takım ya da benzer renkse nötr (sola benzemeyen ilk nötr). */
export function h2hColors(leftTeamId: number, rightTeamId: number): [string, string] {
  const left = cardTeamColor(leftTeamId, []) ?? NEUTRALS[0];
  const neutral = NEUTRALS.find((hex) => !isSimilarColor(hex, left)) ?? NEUTRALS[1];
  const right = leftTeamId === rightTeamId ? neutral : (cardTeamColor(rightTeamId, [left]) ?? neutral);
  return [left, right];
}

export interface H2HImages {
  leftLogo: string | null;
  rightLogo: string | null;
  leftFace: string | null;
  rightFace: string | null;
  brandLogo: string;
}

export interface H2HCardInput {
  left: PlayerSeasonStats;
  right: PlayerSeasonStats;
  mode: H2HMode;
  /** Maçtan başlandıysa maç; serbest modda null. */
  match: { homeTeam: string; awayTeam: string; kickoffUtc: string; homeOrigin: NameOrigin | null; awayOrigin: NameOrigin | null } | null;
  images: H2HImages;
  frame: MatchDayFrame;
}

export interface H2HCardResult {
  card: H2HCard;
  position: H2HPosition;
  warnings: string[];
  dropped: H2HDropped[];
}

/** Grafik kapasitesine sığan en çok satır (önceliğe göre). */
function fittedRows(input: H2HCardInput, position: H2HPosition): { rows: H2HRow[]; dropped: H2HDropped[] } {
  const g = h2hCompareGeometry(input.frame);
  for (let max = MAX_ROWS; max > 0; max -= 1) {
    const built = buildRows(input.left, input.right, position, input.mode, max);
    if (chartRowHeight(g, built.rows.length, groupRows(built.rows).length) !== null) return built;
  }
  return buildRows(input.left, input.right, position, input.mode, 0);
}

function playerCard(player: PlayerSeasonStats, hex: string, logo: string | null, face: string | null): H2HPlayerCard {
  return {
    name: upperName(player.shortName, player.nameOrigin),
    firstName: upperName(firstNameOf(player.fullName), player.nameOrigin),
    subtitle: `${upperName(player.teamName, player.teamOrigin)} · ${upperTr(POSITION_LABELS[player.position])}`,
    sampleLine: `${player.appearances} MAÇ · ${player.minutes} DK`,
    teamLogo: logo,
    hex,
    face,
  };
}

/** "Salah 8, 1'i penaltı" — gol ve penaltı biliniyorsa. */
function goalLine(player: PlayerSeasonStats): string | null {
  const goals = player.values.goals;
  if (goals === undefined) return null;
  if (player.penaltyGoals === null) return `${player.shortName} ${goals}`;
  return player.penaltyGoals > 0 ? `${player.shortName} ${goals}, ${numberPossessive(player.penaltyGoals)} penaltı` : `${player.shortName} ${goals}, penaltı golü yok`;
}

const SOURCE_NAMES = { "api-football": "API-Football", sportmonks: "Sportmonks" } as const;

/** Kaynak satırı: oyuncu başına tek kaynak (karışım yok) — aynıysa bir kez. */
function sourceLine(left: PlayerSeasonStats, right: PlayerSeasonStats): string {
  const [a, b] = [left.freshness.source, right.freshness.source];
  return a === b ? `Veri: ${SOURCE_NAMES[a]}.` : `Veri: ${left.shortName} ${SOURCE_NAMES[a]} · ${right.shortName} ${SOURCE_NAMES[b]}.`;
}

function footnotes(input: H2HCardInput, shown: H2HRow[]): string[] {
  const keys = new Set(shown.map((row) => row.key));
  const notes: string[] = [];
  const explain = [keys.has("xg") ? XG_NOTE : null, keys.has("xa") ? XA_NOTE : null].filter(Boolean).join(" ");
  if (explain) notes.push(explain);
  const goals = [goalLine(input.left), goalLine(input.right)];
  if (goals.every(Boolean)) notes.push(`Gol (sezon toplamı): ${goals.join(" · ")}.`);
  notes.push(`${sourceLine(input.left, input.right)}${input.mode === "PER90" ? " Değerler 90 dakika başına." : ""}`);
  return notes;
}

export function buildH2HCard(input: H2HCardInput): Result<H2HCardResult> {
  const { left, right, mode } = input;
  const position = comparisonPosition(left, right);
  if (!position.ok) return position;
  const [leftHex, rightHex] = h2hColors(left.teamId, right.teamId);
  const { rows, dropped } = fittedRows(input, position.data);
  const hero = buildHero(left, right, position.data, mode);
  const penalties = left.penaltyGoals !== null && right.penaltyGoals !== null && hero.some((row) => row.key === "goals");
  const card: H2HCard = {
    pageLabels: H2H_PAGE_LABELS,
    dateLabel: input.match ? setDateLabel(input.match.kickoffUtc) : left.seasonLabel,
    accentHex: leftHex,
    left: playerCard(left, leftHex, input.images.leftLogo, input.images.leftFace),
    right: playerCard(right, rightHex, input.images.rightLogo, input.images.rightFace),
    modeLabel: mode === "PER90" ? "90 DAKİKA BAŞINA" : "SEZON TOPLAMI",
    hero,
    goalNote: penalties ? `PENALTI ${left.penaltyGoals} – ${right.penaltyGoals}` : "",
    rows,
    fact: factLine(left, right, position.data, mode),
    scopeLabel: [scopeLabel(left, right), freshnessLabel(left, right)].filter(Boolean).join(" · "),
    matchLabel: input.match ? `${upperName(input.match.homeTeam, input.match.homeOrigin)} – ${upperName(input.match.awayTeam, input.match.awayOrigin)}` : "",
    footnotes: footnotes(input, [...hero, ...rows]),
    brandLogo: input.images.brandLogo,
  };
  const language = h2hTextGate(card);
  if (language) return { ok: false, error: { code: "BANNED_LANGUAGE", message: `${language} — kart üretilmedi.` } };
  return { ok: true, data: { card, position: position.data, warnings: comparisonWarnings(left, right), dropped } };
}

/** Kartın bütün metinleri dil kapısından (yasaklı liste); bulgu varsa okunur sebep. */
export function h2hTextGate(card: H2HCard): string | null {
  return bannedWordsGate({
    "sayfa etiketi": card.pageLabels.join(" "),
    oyuncular: [card.left.name, card.left.subtitle, card.right.name, card.right.subtitle].join(" "),
    istatistikler: [...card.hero, ...card.rows].map((row) => row.label).join(" "),
    olgu: card.fact,
    künye: `${card.scopeLabel} ${card.matchLabel}`,
    dipnot: card.footnotes.join(" "),
  });
}
