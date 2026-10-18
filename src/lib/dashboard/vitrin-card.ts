import { setDateLabel } from "@/lib/dashboard/checkmatch-set";
import { distinctTeamColor, readableTeamColors } from "@/lib/dashboard/match-result-theme";
import { upperTr } from "@/lib/dashboard/match-result-labels";
import { bannedWordsGate } from "@/lib/prediction/banned-words";
import { openBoxLines, scenarioTitle, type MatchSides } from "@/lib/prediction/catalog";
import type { PredictionSet, Scenario, ScenarioId } from "@/types/prediction";
import type { VitrinCard, VitrinOpenBox, VitrinSelection } from "@/types/vitrin";

/**
 * Vitrin kartının alanları — saf, TEK KAYNAK (motor, önizleme, görsel test ve offline script ortak).
 * Kilitli kutulara yalnızca başlık geçer. Bütün kart metinleri dil kapısından geçer (`vitrinTextGate`).
 */

export const VITRIN_PAGE_LABEL = "MAÇ ÖNÜ · ANALİZ";
const FALLBACK_ACCENT = "#F5C518";

export interface VitrinMeta {
  sides: MatchSides;
  homeTeamId: number;
  awayTeamId: number;
  kickoffUtc: string;
  /** Resmi turnuva adı ("Trendyol Süper Lig") ve tur ("8. Hafta"). */
  competitionName: string;
  roundLabel: string;
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

function scenarioOf(prediction: PredictionSet, id: ScenarioId): Scenario {
  const scenario = prediction.scenarios.find((entry) => entry.id === id);
  if (!scenario) throw new Error(`Tahmin setinde ${id} senaryosu yok.`);
  return scenario;
}

/** Vurgu: modelin favorisinin okunur kulüp rengi (rakibe benzemeyen), yoksa set altını. */
export function vitrinAccentHex(prediction: PredictionSet, meta: Pick<VitrinMeta, "homeTeamId" | "awayTeamId">): string {
  const result = prediction.scenarios.find((entry) => entry.id === "RESULT_1X2");
  const homeFavourite = (result?.outcomeProbabilities.HOME ?? 0) >= (result?.outcomeProbabilities.AWAY ?? 0);
  const [fav, other] = homeFavourite ? [meta.homeTeamId, meta.awayTeamId] : [meta.awayTeamId, meta.homeTeamId];
  const rival = readableTeamColors({ id: other, colorHex: "" })[0] ?? null;
  return distinctTeamColor({ id: fav, colorHex: "" }, rival) ?? FALLBACK_ACCENT;
}

export function buildVitrinCard(prediction: PredictionSet, selection: VitrinSelection, meta: VitrinMeta, images: VitrinImages): VitrinCard {
  const open = selection.open.map((id): VitrinOpenBox => {
    const scenario = scenarioOf(prediction, id);
    return { title: scenarioTitle(id, meta.sides, scenario.outcome), lines: openBoxLines(scenario, meta.sides), reason: scenario.reason.trim() };
  }) as [VitrinOpenBox, VitrinOpenBox];
  const locked = selection.locked.map((id) => scenarioTitle(id, meta.sides, scenarioOf(prediction, id).outcome)) as [string, string, string];
  return {
    pageLabel: VITRIN_PAGE_LABEL,
    dateLabel: setDateLabel(meta.kickoffUtc),
    competitionLabel: upperTr(meta.competitionName),
    roundLabel: upperTr(meta.roundLabel),
    accentHex: vitrinAccentHex(prediction, meta),
    homeTeam: upperTr(meta.sides.home),
    awayTeam: upperTr(meta.sides.away),
    ...images,
    open,
    locked,
    hook: hookLines(prediction),
  };
}

/** Kartın bütün metinleri dil kapısından: bulgu varsa okunur sebep (kart üretilmez), yoksa null. */
export function vitrinTextGate(card: VitrinCard): string | null {
  const fields: Record<string, string> = {
    "sayfa etiketi": card.pageLabel,
    künye: `${card.competitionLabel} ${card.roundLabel}`,
    kanca: card.hook.join(" "),
  };
  card.open.forEach((box, index) => {
    fields[`açık kutu ${index + 1}`] = [box.title, ...box.lines.map((line) => line.label), box.reason].join(" · ");
  });
  card.locked.forEach((title, index) => {
    fields[`kilitli kutu ${index + 1}`] = title;
  });
  return bannedWordsGate(fields);
}

/** Seçim kuralı: 2 açık + 3 kilitli, tekrarsız, katalogdan. */
export function validSelection(selection: VitrinSelection): boolean {
  const all = [...selection.open, ...selection.locked];
  return new Set(all).size === all.length;
}
