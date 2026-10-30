import { halfSourceLabel } from "@/lib/match-analysis/halves";
import type { MatchAnalysisFacts } from "@/types/match-analysis";

/**
 * Maç Analizi stüdyo özeti (saf). Kişi adları olaylardan — yükleyici onları kart adı kuralından geçirmiştir
 * (`withEventNames`: "V. Osimhen"), stüdyo ham API adı yazmaz. Kırılma anları kartla AYNI seçim (en fazla 2).
 */
export interface AnalysisStudioSummary {
  title: string;
  subtitle: string;
  /** "12' · KAZANDIRAN GOL · V. Osimhen (Galatasaray)" */
  moments: string[];
  events: string;
  halves: string;
  facts: string[];
}

export function analysisStudioSummary(facts: MatchAnalysisFacts): AnalysisStudioSummary {
  const { match } = facts;
  const team = (side: "HOME" | "AWAY") => (side === "HOME" ? match.home.name : match.away.name);
  const moments = facts.events.flatMap((event) =>
    event.breakMoment ? [`${event.minuteLabel} · ${event.breakMoment.label} · ${event.player?.name ?? "—"} (${team(event.side)})${event.score ? ` · ${event.score.home}-${event.score.away}` : ""}`] : [],
  );
  const penalty = match.penaltyScore ? ` (P ${match.penaltyScore})` : "";
  return {
    title: `${match.home.name} ${match.home.goals} – ${match.away.goals} ${match.away.name}${penalty}`,
    subtitle: `${match.competition.name} · ${match.roundLabel}`,
    moments,
    events: `${facts.events.length} olay · eksen ${facts.axisEnd}'`,
    halves: facts.halves.available ? `Var — ${halfSourceLabel(facts.halves.stats.source)} (${facts.halves.stats.rows.length} satır)` : `Düşer: ${facts.halves.reason}`,
    facts: facts.halves.available ? facts.facts.map((fact) => fact.text) : [],
  };
}
