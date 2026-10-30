import { CONTENT_TAGS, hashtagLine } from "@/lib/dashboard/caption-hashtags";
import type { LineupDraft, TeamLineupDraft } from "@/types/lineup";

/**
 * Muhtemel 11 gönderi metni — şablondan (LLM yok): iki takımın dizilişi ve 11'i; sonunda etkileşim sorusu ve
 * 3–5 hashtag (takımlar, künyenin ilk parçasındaki turnuva — "Süper Lig · 30.10 · 20:00" —, #Muhtemel11).
 */

export const LINEUP_QUESTION = "Sizin 11'iniz nasıl olurdu? Yorumlara yazın 👇";

function teamLine(team: TeamLineupDraft): string {
  return `${team.teamName} (${team.formation}): ${team.slots.map((slot) => slot.name.trim()).join(", ")}`;
}

export function buildLineupCaption(draft: LineupDraft): string {
  const competition = draft.matchLabel.split(" · ")[0] ?? null;
  const tags = hashtagLine({ names: [draft.home.teamName, draft.away.teamName], competitions: [competition], type: CONTENT_TAGS.PROBABLE_LINEUPS });
  return [`${draft.headline} | ${draft.home.teamName} - ${draft.away.teamName}`, "", teamLine(draft.home), "", teamLine(draft.away), "", LINEUP_QUESTION, "", tags].join("\n");
}
