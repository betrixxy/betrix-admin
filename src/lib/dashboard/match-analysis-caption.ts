import { matchResultTitle } from "@/lib/dashboard/match-result-caption";
import { hashtag, MAX_HASHTAGS } from "@/lib/dashboard/vitrin-caption";
import { SCORING_KINDS, type MatchAnalysisFacts } from "@/types/match-analysis";

/**
 * Maç Analizi gönderi metni taslağı — şablondan (yapay zekâ yok, bkz. CLAUDE.md 1.10): skor satırı, kırılma
 * anları (kartla aynı veri: dakika + etiket), devre verisi varsa olgular. Link ve alan adı yok, en fazla 5
 * hashtag, sonunda etkileşim sorusu. Admin inceleme ekranında düzenler; üretimde ve onayda dil kapısından geçer.
 */

export const ANALYSIS_QUESTION = "Maçın kırılma anı sizce hangisiydi? Yorumlara yazın 👇";
const MAX_MOMENTS = 4;

export function buildMatchAnalysisCaption(facts: MatchAnalysisFacts): string {
  const { match } = facts;
  const moments = facts.events
    .filter((event) => event.breakMoment)
    .slice(0, MAX_MOMENTS)
    .map((event) => {
      const team = event.side === "HOME" ? match.home.name : match.away.name;
      const score = event.score && SCORING_KINDS.includes(event.kind) ? ` (${event.score.home}-${event.score.away})` : "";
      return `⏱ ${event.minuteLabel} ${event.breakMoment?.label.toLocaleLowerCase("tr-TR")} — ${team}${score}`;
    });
  const facts02 = facts.halves.available ? facts.facts.map((fact) => `📊 ${fact.text}`) : [];
  const tags = [...new Set([hashtag(match.home.name), hashtag(match.away.name), hashtag(match.competition.name), "#MaçAnalizi", "#CheckMatch"])].slice(0, MAX_HASHTAGS);
  return [`MAÇ ANALİZİ | ${matchResultTitle(match)}`, `${match.competition.name} · ${match.roundLabel}`, "", ...moments, ...(facts02.length > 0 ? ["", ...facts02] : []), "", ANALYSIS_QUESTION, "", tags.join(" ")].join("\n");
}
