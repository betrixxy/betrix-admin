import { hashtag, MAX_HASHTAGS } from "@/lib/dashboard/vitrin-caption";
import type { H2HCard, PlayerSeasonStats } from "@/types/player-h2h";

/**
 * Oyuncu karşılaştırması gönderi metni — şablondan (LLM yok). Analiz dili, bahis dili yok (dil kapısı),
 * link yok, en fazla 5 hashtag, sonunda etkileşim sorusu. Değerler kartla aynı (aynı adalet modu).
 */

export const H2H_QUESTION = "Sizce hangisi öne çıkıyor? Yorumlara yazın 👇";

type Player = Pick<PlayerSeasonStats, "fullName" | "shortName" | "teamName">;

export function buildH2HCaption(left: Player, right: Player, card: Pick<H2HCard, "hero" | "fact" | "modeLabel" | "scopeLabel">): string {
  const scope = card.scopeLabel.toLocaleLowerCase("tr-TR").replace(/(^|\s)(\p{L})/gu, (_m, space: string, letter: string) => `${space}${letter.toLocaleUpperCase("tr-TR")}`).replace(" İtibarıyla", " itibarıyla");
  const mode = card.modeLabel === "90 DAKİKA BAŞINA" ? " (90 dakika başına)" : "";
  const lines = card.hero.map((row) => `📊 ${row.label}${mode}: ${left.shortName} ${row.leftText} · ${right.shortName} ${row.rightText}`);
  const tags = [...new Set([hashtag(left.fullName), hashtag(right.fullName), hashtag(left.teamName), hashtag(right.teamName), "#CheckMatch"])].slice(0, MAX_HASHTAGS);
  return [`${left.fullName} – ${right.fullName} | Oyuncu karşılaştırması`, scope, "", ...lines, ...(card.fact ? ["", card.fact] : []), "", H2H_QUESTION, "", tags.join(" ")].join("\n");
}
