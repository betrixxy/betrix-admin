import type { MatchDayFrame } from "@/lib/dashboard/match-day-formats";
import type { TimelineCard } from "@/types/match-analysis";
import type { BlockFilter } from "../checkmatch-set/blocks";
import { BODY } from "../match-day/shared";
import { analysisGeometry } from "./geometry";
import { AnalysisFooter, AnalysisFootnote, AnalysisHeader, AnalysisTitle, TeamsRow } from "./parts";
import { LandscapeTimelineBody } from "./timeline-landscape";
import { VerticalTimelineBody } from "./timeline-vertical";

/**
 * MAÇ ANALİZİ · 01 ZAMAN ÇİZELGESİ — CheckMatch koyu set ailesi. Dikeyde ortada dakika omurgası (ev sahibi solda,
 * deplasman sağda), 16:9'da yatay eksen (ev sahibi üstte, deplasman altta). Zemin motorda (programatik koyu
 * zemin, iki yandan takım ışığı; carousel'de 01 Maç Sonucu'nun bulanık hâli).
 */
export function TimelineTemplate({ card, frame, only }: { card: TimelineCard; frame: MatchDayFrame; only?: BlockFilter }) {
  const g = analysisGeometry(frame);
  return (
    <div tw="relative flex h-full w-full" style={{ fontFamily: BODY }}>
      <AnalysisHeader card={card} g={g} only={only} />
      <AnalysisTitle card={card} g={g} only={only} />
      <TeamsRow card={card} g={g} only={only} />
      {g.landscape ? <LandscapeTimelineBody card={card} g={g} only={only} /> : <VerticalTimelineBody card={card} g={g} only={only} />}
      <AnalysisFootnote card={card} g={g} only={only} />
      <AnalysisFooter card={card} g={g} only={only} />
    </div>
  );
}
