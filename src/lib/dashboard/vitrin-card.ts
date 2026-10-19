import { setDateLabel } from "@/lib/dashboard/checkmatch-set";
import { clubColors } from "@/lib/dashboard/club-colors";
import { isReadableOnCard, isSimilarColor } from "@/lib/dashboard/color-math";
import { upperTr } from "@/lib/dashboard/match-result-labels";
import { bannedWordsGate } from "@/lib/prediction/banned-words";
import { openBoxLines, scenarioTitle, type MatchSides } from "@/lib/prediction/catalog";
import type { PredictionSet, Scenario, ScenarioId } from "@/types/prediction";
import type { MatchResultLetter } from "@/types/sports";
import type { VitrinCard, VitrinOpenBox, VitrinSelection, VitrinWinBar } from "@/types/vitrin";

/**
 * Vitrin carousel'inin alanları — saf, TEK KAYNAK (motor, önizleme, görsel test ve offline script ortak).
 * Kilitli kutulara yalnızca başlık geçer. Bütün kart metinleri dil kapısından geçer (`vitrinTextGate`).
 */

export const VITRIN_PAGE_LABELS: [string, string] = ["01 · MAÇ ÖNÜ", "02 · ANALİZ"];
/** Beraberlik segmentinin nötr grisi — takım renkleri buna benzememeli. */
export const DRAW_HEX = "#5B606B";
const FALLBACK_SIDE_HEX: [string, string] = ["#E8E8EA", "#9AA3B5"];
/** İki favori arasındaki fark bu puanın altındaysa manşet "kararsız" der. */
export const CLEAR_FAVOURITE_POINTS = 8;

export interface VitrinMeta {
  sides: MatchSides;
  homeTeamId: number;
  awayTeamId: number;
  kickoffUtc: string;
  /** Resmi turnuva adı ("Trendyol Süper Lig") ve tur ("8. Hafta"). */
  competitionName: string;
  roundLabel: string;
  /** Son 5 maç, eskiden yeniye. */
  homeForm: MatchResultLetter[];
  awayForm: MatchResultLetter[];
}

export interface VitrinImages {
  homeLogo: string | null;
  awayLogo: string | null;
  brandLogo: string;
}

export const hookLines = (prediction: Pick<PredictionSet, "scenarioCount" | "surprisePct">): [string, string] => [
  `Modelimiz bu maç için ${prediction.scenarioCount} senaryo hesapladı.`,
  `En sürpriz olanı sadece %${prediction.surprisePct} ihtimalle gerçekleşiyor — tamamı checkmatch.net'te.`,
];

/** Kartın tek satırlık alt kancası. */
export const hookLine = (prediction: Pick<PredictionSet, "surprisePct">): string => `En sürpriz senaryo yalnızca %${prediction.surprisePct} — tamamı checkmatch.net'te`;

function scenarioOf(prediction: PredictionSet, id: ScenarioId): Scenario {
  const scenario = prediction.scenarios.find((entry) => entry.id === id);
  if (!scenario) throw new Error(`Tahmin setinde ${id} senaryosu yok.`);
  return scenario;
}

/**
 * Kartın takım rengi (2026-10-19 kararı): ana renk koyu zeminde OLDUĞU GİBİ okunuyorsa o, değilse
 * ikincil — açıklık yükseltilmez (bordo → pembe yok). Beraberlik grisine ve rakibin rengine benzeyen
 * aday atlanır. Çubuk, manşet, vurgu ve fotoğraf tonu bu tek rengi kullanır.
 */
export function cardTeamColor(teamId: number, avoid: string[]): string | null {
  const club = clubColors(teamId);
  return [club?.primary, club?.secondary].find((hex): hex is string => isReadableOnCard(hex) && avoid.every((other) => !isSimilarColor(hex, other))) ?? null;
}

export function sideColors(homeTeamId: number, awayTeamId: number): [string, string] {
  const home = cardTeamColor(homeTeamId, [DRAW_HEX]) ?? FALLBACK_SIDE_HEX[0];
  const away = cardTeamColor(awayTeamId, [DRAW_HEX, home]) ?? (isSimilarColor(FALLBACK_SIDE_HEX[1], home) ? FALLBACK_SIDE_HEX[0] : FALLBACK_SIDE_HEX[1]);
  return [home, away];
}

/** Vurgu: favorinin kart rengi (çubuktaki ve manşetteki renkle aynı); favori yoksa ev sahibininki. */
export function vitrinAccentHex(bar: Pick<VitrinWinBar, "favourite" | "home" | "away">, colors: [string, string]): string {
  const homeSide = bar.favourite ? bar.favourite === "HOME" : bar.home >= bar.away;
  return homeSide ? colors[0] : colors[1];
}

/** 0–1 olasılıklar → toplamı 100 olan tamsayılar (en büyük kalan yöntemi). */
export function wholePercents(values: [number, number, number]): [number, number, number] {
  const total = values.reduce((sum, value) => sum + value, 0) || 1;
  const raw = values.map((value) => (value / total) * 100);
  const floors = raw.map(Math.floor);
  let rest = 100 - floors.reduce((sum, value) => sum + value, 0);
  const order = raw.map((value, index) => ({ index, frac: value - Math.floor(value) })).sort((a, b) => b.frac - a.frac);
  for (const { index } of order) {
    if (rest <= 0) break;
    floors[index] = (floors[index] ?? 0) + 1;
    rest -= 1;
  }
  return floors as [number, number, number];
}

/** Kazanma çubuğu + kural tabanlı manşet: favori net değilse (fark < 8 puan ya da beraberlik önde) kararsız. */
export function winBar(prediction: PredictionSet, sides: MatchSides): VitrinWinBar {
  const p = scenarioOf(prediction, "RESULT_1X2").outcomeProbabilities;
  const [home, draw, away] = wholePercents([p.HOME ?? 0, p.DRAW ?? 0, p.AWAY ?? 0]);
  const ranked = [
    { side: "HOME" as const, value: home },
    { side: "DRAW" as const, value: draw },
    { side: "AWAY" as const, value: away },
  ].sort((a, b) => b.value - a.value);
  const [top, second] = ranked;
  if (!top || !second || top.side === "DRAW" || top.value - second.value < CLEAR_FAVOURITE_POINTS) return { home, draw, away, favourite: null, headline: "Model kararsız: dengeli bir maç" };
  return { home, draw, away, favourite: top.side, headline: `Modelimiz ${top.side === "HOME" ? sides.home : sides.away} diyor` };
}

export function buildVitrinCard(prediction: PredictionSet, selection: VitrinSelection, meta: VitrinMeta, images: VitrinImages): VitrinCard {
  const open = selection.open.map((id): VitrinOpenBox => {
    const scenario = scenarioOf(prediction, id);
    return { title: scenarioTitle(id, meta.sides, scenario.outcome), lines: openBoxLines(scenario, meta.sides), reason: scenario.reason.trim() };
  }) as [VitrinOpenBox, VitrinOpenBox];
  const locked = selection.locked.map((id) => scenarioTitle(id, meta.sides, scenarioOf(prediction, id).outcome)) as [string, string, string];
  const colors = sideColors(meta.homeTeamId, meta.awayTeamId);
  const bar = winBar(prediction, meta.sides);
  return {
    pageLabels: VITRIN_PAGE_LABELS,
    dateLabel: setDateLabel(meta.kickoffUtc),
    competitionLabel: upperTr(meta.competitionName),
    roundLabel: upperTr(meta.roundLabel),
    accentHex: vitrinAccentHex(bar, colors),
    homeTeam: upperTr(meta.sides.home),
    awayTeam: upperTr(meta.sides.away),
    homeHex: colors[0],
    awayHex: colors[1],
    homeForm: meta.homeForm,
    awayForm: meta.awayForm,
    ...images,
    winBar: bar,
    open,
    locked,
    hiddenCount: Math.max(0, prediction.scenarioCount - selection.open.length),
    hook: hookLines(prediction),
    hookLine: hookLine(prediction),
  };
}

/** Kartın bütün metinleri dil kapısından: bulgu varsa okunur sebep (kart üretilmez), yoksa null. */
export function vitrinTextGate(card: VitrinCard): string | null {
  const fields: Record<string, string> = {
    "sayfa etiketi": card.pageLabels.join(" "),
    künye: `${card.competitionLabel} ${card.roundLabel}`,
    manşet: card.winBar.headline,
    kanca: [...card.hook, card.hookLine].join(" "),
  };
  card.open.forEach((box, index) => {
    fields[`açık kutu ${index + 1}`] = [box.title, ...box.lines.map((line) => line.label), box.reason].join(" · ");
  });
  card.locked.forEach((title, index) => {
    fields[`kilitli kutu ${index + 1}`] = title;
  });
  return bannedWordsGate(fields);
}

/** Seçim kuralı: 2 açık + 3 kilitli, tekrarsız; 1. açık kutu kazanma olasılıkları (poster çubuğu). */
export function validSelection(selection: VitrinSelection): boolean {
  const all = [...selection.open, ...selection.locked];
  return selection.open[0] === "RESULT_1X2" && new Set(all).size === all.length;
}
