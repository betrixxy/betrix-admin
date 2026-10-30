import { CONTENT_TAGS, hashtagLine } from "@/lib/dashboard/caption-hashtags";
import type { DrawState, DrawVariant } from "@/types/draw";
import { drawTeamName } from "./entry";
import { drawCompetition } from "./rounds";

/**
 * Kura sonucu gönderi metni — şablondan (LLM yok). Yalnızca olgu: kim kiminle, iç saha / deplasman, ilk maç
 * nerede. Yorum yok ("zorlu kura" vb.), bahis dili yok, link yok, en fazla 5 hashtag, sonunda etkileşim
 * sorusu. Eksik girişte yalnızca girilenler yazılır.
 */

export const DRAW_QUESTION = "En çok hangi maçı bekliyorsunuz? Yorumlara yazın 👇";

const short = (state: DrawState) => drawCompetition(state.competition.id)?.short ?? state.competition.name;
const tagsOf = (names: string[], competitions: string[]) => hashtagLine({ names, competitions, type: CONTENT_TAGS.DRAWS_AND_PAIRINGS });
const list = (state: DrawState, ids: number[]) => ids.map((id) => drawTeamName(state, id)).join(", ");

function teamLines(state: DrawState, teamId: number): string[] {
  const name = (id: number) => drawTeamName(state, id);
  if (state.stage === "KNOCKOUT") {
    const tie = state.ties.find((t) => t.first === teamId || t.second === teamId);
    if (!tie) return [];
    const opponent = tie.first === teamId ? tie.second : tie.first;
    return [`${name(teamId)} – ${name(opponent)} (ilk maç ${tie.first === teamId ? "iç sahada" : "deplasmanda"})`];
  }
  const own = state.fixtures.filter((f) => f.teamId === teamId);
  if (own.length === 0) return [];
  const home = own.filter((f) => f.venue === "HOME").map((f) => f.opponentId);
  const away = own.filter((f) => f.venue === "AWAY").map((f) => f.opponentId);
  return [`${name(teamId)}:`, ...(home.length ? [`🏠 İç saha: ${list(state, home)}`] : []), ...(away.length ? [`✈️ Deplasman: ${list(state, away)}`] : [])];
}

export function buildDrawCaption(variant: DrawVariant, states: DrawState[], focusTeamId: number | null): string {
  const first = states[0];
  if (!first) return "";
  if (variant === "TEAM" && focusTeamId) {
    const team = drawTeamName(first, focusTeamId);
    const head = first.stage === "KNOCKOUT" ? `${team} | ${short(first)} ${first.roundLabel} rakibi belli oldu` : `${team} | ${short(first)} ${first.roundLabel} rakipleri belli oldu`;
    return [head, "", ...teamLines(first, focusTeamId), "", DRAW_QUESTION, "", tagsOf([team], [short(first)])].join("\n");
  }
  if (variant === "TURKISH") {
    const blocks = states.flatMap((state) =>
      state.teams
        .filter((team) => team.country === "Turkey")
        .map((team) => teamLines(state, team.id))
        .filter((lines) => lines.length > 0)
        .map((lines) => [`${short(state)} · ${state.roundLabel}`, ...lines].join("\n")),
    );
    return ["Temsilcilerimizin rakipleri belli oldu", "", ...blocks.flatMap((block) => [block, ""]), DRAW_QUESTION, "", tagsOf([], states.map(short))].join("\n");
  }
  const ties = first.ties.map((tie) => `${drawTeamName(first, tie.first)} – ${drawTeamName(first, tie.second)}`);
  return [`${short(first)} ${first.roundLabel} eşleşmeleri`, "", ...ties, "", DRAW_QUESTION, "", tagsOf([], [short(first)])].join("\n");
}
