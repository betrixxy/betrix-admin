import { analysisFacts } from "@/lib/match-analysis/facts";
import { withMoments } from "@/lib/match-analysis/moments";
import { toAnalysisEvents } from "@/lib/services/api-football/analysis-events-mappers";
import { toMatchResultFacts } from "@/lib/services/api-football/match-result-mappers";
import type { ApiFootballFixtureResultRaw } from "@/lib/services/api-football/types";
import type { HalvesOutcome, MatchAnalysisFacts } from "@/types/match-analysis";

/**
 * Maç Analizi verisi (saf): bitmiş maç yanıtı (`/fixtures?id=`) + seçilmiş devre verisi (`chooseHalves`) →
 * `MatchAnalysisFacts`. Skor, golcüler ve maç künyesi Maç Sonucu ile AYNI eşleyiciden (`toMatchResultFacts`) —
 * set kartlarıyla çelişemez. Olaylardan sayılan skor resmi skorla tutmuyorsa kırılma anı ve skor etiketi
 * yazılmaz, stüdyoda uyarı çıkar (eksik olay akışıyla yanlış "İLK GOL" yazılmasın). Bitmemiş maçta null.
 */
export function assembleMatchAnalysisFacts(raw: ApiFootballFixtureResultRaw, halves: HalvesOutcome): MatchAnalysisFacts | null {
  const match = toMatchResultFacts(raw);
  if (!match) return null;
  const sorted = toAnalysisEvents(raw);
  const counted = withMoments(sorted, false).final;
  const scoreConsistent = counted.home === match.home.goals && counted.away === match.away.goals;
  const { events, final, halftime } = withMoments(sorted, scoreConsistent);
  const warnings = scoreConsistent
    ? []
    : [`Olay akışındaki goller (${counted.home}-${counted.away}) resmi skorla (${match.home.goals}-${match.away.goals}) tutmuyor — kırılma anları ve skor etiketleri yazılmadı, olay akışını kontrol edin.`];
  const extraTime = match.statusShort !== "FT" || events.some((event) => event.elapsed > 90);
  return {
    match,
    events,
    halftime,
    scoreConsistent,
    axisEnd: extraTime ? 120 : 90,
    halves,
    facts: analysisFacts({ events, halftime, final, outcome: match.outcome, names: { HOME: match.home.name, AWAY: match.away.name }, halves, scoreConsistent }),
    warnings,
  };
}
