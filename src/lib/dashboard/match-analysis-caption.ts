import { matchResultTitle } from "@/lib/dashboard/match-result-caption";
import { BREAK_CAPTIONS } from "@/lib/match-analysis/moments";
import { CONTENT_TAGS, hashtagLine } from "@/lib/dashboard/caption-hashtags";
import { SCORING_KINDS, type MatchAnalysisFacts } from "@/types/match-analysis";

/**
 * Maç Analizi gönderi metni taslağı — şablondan (yapay zekâ yok, bkz. CLAUDE.md 1.10): skor satırı, kırılma
 * anları (kartla aynı veri: dakika + etiket), devre verisi varsa olgular. Link ve alan adı yok, en fazla 5
 * hashtag, sonunda etkileşim sorusu. Admin inceleme ekranında düzenler; üretimde ve onayda dil kapısından geçer.
 */

export const ANALYSIS_QUESTION = "Maçın kırılma anı sizce hangisiydi? Yorumlara yazın 👇";

export function buildMatchAnalysisCaption(facts: MatchAnalysisFacts): string {
  const { match } = facts;
  const moments = facts.events
    .filter((event) => event.breakMoment)
    .map((event) => {
      const team = event.side === "HOME" ? match.home.name : match.away.name;
      const score = event.score && SCORING_KINDS.includes(event.kind) ? ` (${event.score.home}-${event.score.away})` : "";
      return `⏱ ${event.minuteLabel} ${event.breakMoment ? BREAK_CAPTIONS[event.breakMoment.kind] : ""} — ${team}${score}`;
    });
  const facts02 = facts.halves.available ? facts.facts.map((fact) => `📊 ${fact.text}`) : [];
  const tags = captionTags(match);
  return [`MAÇ ANALİZİ | ${matchResultTitle(match)}`, `${match.competition.name} · ${match.roundLabel}`, "", ...moments, ...(facts02.length > 0 ? ["", ...facts02] : []), "", ANALYSIS_QUESTION, "", tags].join("\n");
}

const captionTags = (match: MatchAnalysisFacts["match"]) =>
  hashtagLine({ names: [match.home.name, match.away.name], competitions: [match.competition.name], type: CONTENT_TAGS.MATCH_ANALYSIS });
