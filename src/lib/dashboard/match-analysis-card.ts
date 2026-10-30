import { setDateLabel } from "@/lib/dashboard/checkmatch-set";
import { upperTr } from "@/lib/dashboard/match-result-labels";
import { resultAccentHex } from "@/lib/dashboard/match-result-theme";
import { upperCompetition, upperName, upperTeamName, type TeamOrigin } from "@/lib/dashboard/name-case";
import { teamHexes } from "@/lib/dashboard/player-stats-card";
import { formatNumber } from "@/lib/format/number";
import { halfSourceLabel } from "@/lib/match-analysis/halves";
import { planTimeline } from "@/lib/match-analysis/timeline";
import { GENERIC_VAR_LABEL } from "@/lib/services/api-football/analysis-events-mappers";
import type { MatchDayFrame } from "@/lib/dashboard/match-day-formats";
import { analysisGeometry } from "@/skills/render-engine/templates/match-analysis/geometry";
import { laneLayout, verticalFits } from "@/skills/render-engine/templates/match-analysis/timeline-geometry";
import type { AnalysisCardBase, AnalysisEvent, AnalysisEventKind, AnalysisPerson, HalfRow, HalfStatKey, HalfStats, HalvesCard, MatchAnalysisFacts, TimelineCard, TimelineDivider, TimelineRowCard } from "@/types/match-analysis";

/**
 * Maç Analizi kart alanları (saf): büyük harfli adlar (köken kuralı), takım renkleri (ortak renk kuralı —
 * Oyuncu İstatistikleri ile aynı `teamHexes`, asla altın/marka), vurgu (set kuralı `resultAccentHex`), tarih
 * (`setDateLabel`), lig (`upperCompetition`), sayılar (`formatNumber`). Zaman çizelgesinin satırları formatın
 * geometrisine göre yoğunluk kuralından geçer (`planTimeline`): sığmayan değişiklik/sarı kart satırları düşer,
 * dipnotta sayısıyla yazılır.
 */

export const ANALYSIS_TITLE = "MAÇ ANALİZİ";
export const TIMELINE_PAGE_LABEL = "01 · ZAMAN ÇİZELGESİ";
export const HALVES_PAGE_LABEL = "02 · DEVRE DEVRE";

export interface AnalysisImages {
  homeLogo: string | null;
  awayLogo: string | null;
  brandLogo: string;
}

const KIND_LABELS: Record<AnalysisEventKind, string> = {
  GOAL: "GOL",
  PENALTY_GOAL: "PENALTI GOLÜ",
  OWN_GOAL: "KENDİ KALESİNE",
  MISSED_PENALTY: "PENALTI",
  YELLOW: "SARI KART",
  SECOND_YELLOW: "İKİNCİ SARI",
  RED: "KIRMIZI KART",
  SUBSTITUTION: "DEĞİŞİKLİK",
  VAR: "VAR",
};

const MARKS: Partial<Record<AnalysisEventKind, string>> = { PENALTY_GOAL: "(P)", OWN_GOAL: "(KK)", MISSED_PENALTY: "(P KAÇTI)", SECOND_YELLOW: "(2. SARI)" };

function base(facts: MatchAnalysisFacts, images: AnalysisImages, pageLabel: string | null, footnote: string): AnalysisCardBase {
  const { match } = facts;
  const hex = teamHexes(match);
  return {
    accentHex: resultAccentHex(match),
    homeHex: hex.HOME,
    awayHex: hex.AWAY,
    pageLabel,
    dateLabel: setDateLabel(match.kickoffUtc),
    title: ANALYSIS_TITLE,
    homeTeam: upperTeamName(match.home.name, match.home.origin),
    awayTeam: upperTeamName(match.away.name, match.away.origin),
    homeGoals: match.home.goals,
    awayGoals: match.away.goals,
    homeLogo: images.homeLogo,
    awayLogo: images.awayLogo,
    competitionLabel: upperCompetition(match.competition.name),
    roundLabel: upperTr(match.roundLabel),
    brandLogo: images.brandLogo,
    footnote,
  };
}

const upperPerson = (person: AnalysisPerson | null, origin: TeamOrigin | undefined) => (person ? upperName(person.name, person.origin ?? origin?.people) : null);

/** Bir satır grubunu (çoğu tek olay) kart satırına çevirir. */
export function timelineRow(group: readonly AnalysisEvent[], facts: MatchAnalysisFacts): TimelineRowCard | null {
  const head = group[0];
  if (!head) return null;
  const origin = head.side === "HOME" ? facts.match.home.origin : facts.match.away.origin;
  const common = { side: head.side, kind: head.kind, minuteLabel: head.minuteLabel, elapsed: head.elapsed, extra: head.extra, mark: MARKS[head.kind] ?? null, breakLabel: head.breakMoment?.label ?? null };
  const score = head.score && facts.scoreConsistent ? `${head.score.home}-${head.score.away}` : null;
  if (head.kind === "SUBSTITUTION") {
    if (group.length > 1) {
      const entering = group.map((event) => upperPerson(event.related, origin)).filter((name): name is string => name !== null);
      return { ...common, text: `${group.length} DEĞİŞİKLİK`, detail: entering.length > 0 ? entering.join(", ") : null, scoreLabel: null };
    }
    return { ...common, text: upperPerson(head.related, origin) ?? KIND_LABELS.SUBSTITUTION, detail: upperPerson(head.player, origin), scoreLabel: null };
  }
  if (head.kind === "VAR") {
    const label = head.varLabel && head.varLabel !== GENERIC_VAR_LABEL ? `VAR · ${upperTr(head.varLabel)}` : "VAR";
    return { ...common, text: label, detail: upperPerson(head.player, origin), scoreLabel: null };
  }
  // KK: golü atan rakipten — adın kökeni kendi harfinden/uyruğundan, yoksa rakibin kişi kökeni.
  const playerOrigin = head.kind === "OWN_GOAL" ? (head.side === "HOME" ? facts.match.away.origin : facts.match.home.origin) : origin;
  return { ...common, text: upperPerson(head.player, playerOrigin) ?? KIND_LABELS[head.kind], detail: null, scoreLabel: score };
}

export function timelineRows(groups: readonly AnalysisEvent[][], facts: MatchAnalysisFacts): TimelineRowCard[] {
  return groups.map((group) => timelineRow(group, facts)).filter((row): row is TimelineRowCard => row !== null);
}

/** Ayraçlar: devre arası, (uzatmalı maçta) 90. dakika, maç sonu. */
export function timelineDividers(rows: readonly TimelineRowCard[], facts: MatchAnalysisFacts): TimelineDivider[] {
  const { match, halftime, scoreConsistent } = facts;
  const firstAfter = (minute: number) => {
    const index = rows.findIndex((row) => row.elapsed > minute);
    return index < 0 ? rows.length : index;
  };
  const dividers: TimelineDivider[] = [{ beforeRow: firstAfter(45), label: scoreConsistent ? `İLK YARI ${halftime.home}-${halftime.away}` : "İLK YARI" }];
  if (facts.axisEnd === 120) {
    const regular = facts.events.filter((event) => event.score && event.elapsed <= 90).at(-1)?.score ?? { home: 0, away: 0 };
    dividers.push({ beforeRow: firstAfter(90), label: scoreConsistent ? `90' ${regular.home}-${regular.away}` : "90'" });
  }
  const penalty = match.penaltyScore ? ` · PEN ${match.penaltyScore}` : "";
  dividers.push({ beforeRow: rows.length, label: `MAÇ SONU ${match.home.goals}-${match.away.goals}${penalty}` });
  return dividers;
}

function timelineFootnote(omitted: { substitutions: number; yellows: number }): string {
  const parts = ["Olaylar: API-Football"];
  if (omitted.substitutions > 0) parts.push(`${omitted.substitutions} oyuncu değişikliği sığmadığı için yazılmadı`);
  if (omitted.yellows > 0) parts.push(`${omitted.yellows} sarı kart sığmadığı için yazılmadı`);
  return parts.join(" · ");
}

/** 01 kartı — `frame` yoğunluk kuralı için (format kapasitesi). */
export function buildTimelineCard(facts: MatchAnalysisFacts, frame: MatchDayFrame, images: AnalysisImages, pageLabel: string | null = TIMELINE_PAGE_LABEL): TimelineCard {
  const g = analysisGeometry(frame);
  const fits = (groups: AnalysisEvent[][]) => {
    const rows = timelineRows(groups, facts);
    return g.landscape ? laneLayout(g, rows, facts.axisEnd).ok : verticalFits(g, rows.length, timelineDividers(rows, facts).length);
  };
  const plan = planTimeline(facts.events, fits);
  const rows = timelineRows(plan.groups, facts);
  return { ...base(facts, images, pageLabel, timelineFootnote(plan.omitted)), rows, dividers: timelineDividers(rows, facts), axisEnd: facts.axisEnd };
}

const HALF_LABELS: Record<HalfStatKey, string> = {
  possession: "TOPA SAHİP OLMA",
  shotsTotal: "ŞUT",
  shotsOnTarget: "İSABETLİ ŞUT",
  xg: "xG",
  corners: "KORNER",
};

function halfValue(key: HalfStatKey, value: number): string {
  if (key === "possession") return `%${formatNumber(value, { maxDecimals: 0 })}`;
  if (key === "xg") return formatNumber(value, { decimals: 2 });
  return formatNumber(value, { maxDecimals: 0 });
}

const share = (home: number, away: number) => (home + away > 0 ? home / (home + away) : 0.5);
const side = (key: HalfStatKey, pair: HalfRow["first"]) => ({ home: halfValue(key, pair.home), away: halfValue(key, pair.away), homeShare: share(pair.home, pair.away) });

/** 02 kartı — yalnızca devre verisi seçildiyse (`facts.halves.available`). */
export function buildHalvesCard(facts: MatchAnalysisFacts, stats: HalfStats, images: AnalysisImages, pageLabel: string | null = HALVES_PAGE_LABEL): HalvesCard {
  return {
    ...base(facts, images, pageLabel, `Devre verisi: ${halfSourceLabel(stats.source)} · Olaylar: API-Football`),
    rows: stats.rows.map((row) => ({ key: row.key, label: HALF_LABELS[row.key], first: side(row.key, row.first), second: side(row.key, row.second) })),
    facts: facts.facts.map((fact) => fact.text),
    firstLabel: "İLK YARI",
    secondLabel: "İKİNCİ YARI",
  };
}
