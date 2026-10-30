import { upperTr } from "@/lib/dashboard/match-result-labels";
import { teamPairColors } from "@/lib/dashboard/match-result-theme";
import { upperCompetition, upperTeamName } from "@/lib/dashboard/name-case";
import { fullDate } from "@/lib/format/dates";
import { HIT_LABEL, MISS_LABEL, RATE_LABEL, scoreText } from "@/lib/prediction/scorecard-labels";
import type { HitSummary, MatchScorecardData, PeriodKind, PeriodScorecardData, ScorecardMatch } from "@/types/prediction-scorecard";
import type { MatchScorecardCard, PeriodScorecardCard, ScorecardHero } from "@/types/prediction-scorecard-card";

/**
 * Tahmin Karnesi kart alanları (saf): veri kurucusunun (`lib/prediction/scorecard.ts`) çıktısı → büyük harfli,
 * biçimli kart metinleri. Takım adı kart adından köken kuralıyla büyür (`upperTeamName`), lig adı tek tablodan
 * (`competition-names.ts`, `upperCompetition`), tarih `format/dates.ts`. Zemin ışığı A'da iki takımın rengi
 * (ortak renk kuralı `teamPairColors`), B'de nötr (beyaz + gümüş) — altın/marka rengi değil.
 */

export const SCORECARD_TITLE = "TAHMİN KARNESİ";
export const MATCH_KICKER = "MAÇ KARNESİ";
export const PERIOD_KICKERS: Record<PeriodKind, string> = { WEEK: "HAFTALIK KARNE", MONTH: "AYLIK KARNE", SEASON: "SEZON KARNESİ" };
const NEUTRAL_GLOW: [string, string] = ["#ffffff", "#c9ced6"];

/** Ana sayı: yüzde (n ≥ 10) ya da "3 TAHMİNDE 2 TUTTU"; "İLK TAHMİNLER" etiketi yalnızca dönem karnesinde. */
function heroOf(summary: HitSummary, withBadge: boolean): ScorecardHero {
  if (summary.kind === "RATE") return { kind: "RATE", percent: summary.percent, line: `${RATE_LABEL} · ${upperTr(`${summary.total} tahminde ${summary.hits} tuttu`)}` };
  return { kind: "SMALL_SAMPLE", text: upperTr(summary.text), badge: withBadge ? summary.badge : null };
}

/** "KONYASPOR 1–2 GALATASARAY" — normal süre skoru (karnenin okuduğu skor). */
export function scorecardMatchLine(match: ScorecardMatch): string {
  const score = match.score.fulltime ? scoreText(match.score.fulltime) : "–";
  return `${upperTeamName(match.home.name, match.home.origin)} ${score} ${upperTeamName(match.away.name, match.away.origin)}`;
}

/** "TRENDYOL SÜPER LİG · 10. HAFTA · 30.10.2026" */
export function scorecardMetaLine(match: ScorecardMatch): string {
  return [upperCompetition(match.competition.name), upperTr(match.roundLabel), fullDate(match.kickoffUtc)].filter(Boolean).join(" · ");
}

export function buildMatchScorecardCard(input: { match: ScorecardMatch; data: MatchScorecardData; brandLogo: string; kicker?: string }): MatchScorecardCard {
  const { match, data } = input;
  return {
    kind: "MATCH",
    kicker: input.kicker ?? MATCH_KICKER,
    title: SCORECARD_TITLE,
    subtitle: scorecardMatchLine(match),
    hero: heroOf(data.summary, false),
    strip: data.rows.map((row) => row.status),
    rows: data.rows.map((row) => ({
      scenarioId: row.scenarioId,
      question: row.question,
      model: `Model: ${row.answer} · ${row.percent}`,
      actual: `Gerçekleşen: ${row.actual}`,
      status: row.status,
      statusLabel: row.status === "HIT" ? HIT_LABEL : MISS_LABEL,
    })),
    footnote: "Yayınlanan bütün tahminler · normal süre skoru (90 dk)",
    footerLine: scorecardMetaLine(match),
    brandLogo: input.brandLogo,
    glowHexes: teamPairColors(match.home.id, match.away.id),
  };
}

function versionValue(summary: HitSummary): string {
  return summary.kind === "RATE" ? `%${summary.percent} · ${summary.hits}/${summary.total}` : summary.text;
}

export function buildPeriodScorecardCard(input: { data: PeriodScorecardData; brandLogo: string; kicker?: string }): PeriodScorecardCard {
  const { data } = input;
  const left = [data.pending > 0 ? `${data.pending} bekleyen` : null, data.voided > 0 ? `${data.voided} sonuçlanmadı` : null].filter(Boolean).join(", ");
  return {
    kind: "PERIOD",
    kicker: input.kicker ?? PERIOD_KICKERS[data.period.kind],
    title: SCORECARD_TITLE,
    subtitle: data.period.label,
    hero: heroOf(data.summary, true),
    strip: data.strip,
    breakdown: data.breakdown.map((row) => ({ label: row.label, value: row.value, ratio: row.total > 0 ? row.hits / row.total : 0 })),
    versions: data.versions?.map((row) => ({ label: upperTr(row.label), value: versionValue(row.summary) })) ?? null,
    footnote: left ? `Normal süre skoru (90 dk) · ${left} (karneye girmez)` : "Normal süre skoru (90 dk)",
    footerLine: "YAYINLANAN BÜTÜN TAHMİNLER",
    brandLogo: input.brandLogo,
    glowHexes: NEUTRAL_GLOW,
  };
}
