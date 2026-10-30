import { hashtag, MAX_HASHTAGS } from "@/lib/dashboard/vitrin-caption";
import { scoreText } from "@/lib/prediction/scorecard-labels";
import type { MatchScorecardData, PeriodScorecardData, ScorecardMatch } from "@/types/prediction-scorecard";

/**
 * Tahmin Karnesi gönderi metni — şablondan (LLM yok): her sayı karneden; "tuttu / tutmadı", "isabet oranı";
 * bahis dili yok (kart metinleriyle aynı kapı), link ve alan adı yok, en fazla 5 hashtag, sonunda etkileşim
 * sorusu. Takım/lig adları büyütülmemiş kart adlarından.
 */

export const SCORECARD_QUESTION = "Siz hangisini bildiniz? Yorumlara yazın 👇";
const TAGS = ["#TahminKarnesi", "#CheckMatch"];

const tags = (extra: string[]) => [...new Set([...extra, ...TAGS])].slice(-MAX_HASHTAGS).join(" ");

export function buildMatchScorecardCaption(match: ScorecardMatch, data: MatchScorecardData): string {
  const score = match.score.fulltime ? ` ${scoreText(match.score.fulltime)} ` : " – ";
  const rows = data.rows.map((row) => `${row.status === "HIT" ? "✅" : "❌"} ${row.question} Model: ${row.answer} (${row.percent}) · Gerçekleşen: ${row.actual} — ${row.status === "HIT" ? "tuttu" : "tutmadı"}`);
  return [
    `📋 Tahmin Karnesi | ${match.home.name}${score}${match.away.name}`,
    `${match.competition.name} · ${match.roundLabel}`,
    "",
    ...rows,
    "",
    `${data.summary.text}. Yayınladığımız bütün tahminler karnede — tutmayanlar dahil.`,
    "",
    SCORECARD_QUESTION,
    "",
    tags([hashtag(match.home.name), hashtag(match.away.name), hashtag(match.competition.name)]),
  ].join("\n");
}

export function buildPeriodScorecardCaption(data: PeriodScorecardData): string {
  const breakdown = data.breakdown.map((row) => `• ${row.label}: ${row.value}`);
  const versions = data.versions?.map((row) => `• ${row.label}: ${row.summary.text}`) ?? [];
  return [
    `📋 Tahmin Karnesi | ${data.period.label}`,
    "",
    `${data.summary.text}.`,
    ...(data.summary.kind === "SMALL_SAMPLE" ? ["İlk tahminler — örneklem büyüdükçe isabet oranını yüzdeyle paylaşacağız."] : []),
    "",
    ...breakdown,
    ...(versions.length ? ["", "Model sürümüne göre:", ...versions] : []),
    "",
    `Son ${data.strip.length}: ${data.strip.map((status) => (status === "HIT" ? "✅" : "❌")).join("")}`,
    "Yayınladığımız bütün tahminler karnede — tutmayanlar dahil.",
    "",
    SCORECARD_QUESTION,
    "",
    tags([]),
  ].join("\n");
}
