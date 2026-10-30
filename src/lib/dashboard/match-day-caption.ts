import { CONTENT_TAGS, hashtagLine } from "@/lib/dashboard/caption-hashtags";
import type { MatchDayCard } from "@/types/match-day";

/**
 * Maç Günü gönderi metni — şablondan (LLM yok): başlık (yazıldığı hâliyle takım adları), künye, tarih/saat,
 * stadyum/hakem; sonunda etkileşim sorusu ve 3–5 hashtag (`caption-hashtags.ts`; büyük harfli lig künyesi
 * tablodan #SüperLig'e çözülür). Satır içi ayraç " · " (çift boşluk yok).
 */

export const MATCH_DAY_QUESTION = "Sizce kim kazanır? Yorumlara yazın 👇";

export function buildMatchDayCaption(card: MatchDayCard): string {
  const header = [card.weekLabel, card.leagueLabel].filter(Boolean).join(" · ");
  const tags = hashtagLine({ names: [card.homeTeamName, card.awayTeamName], competitions: [card.leagueLabel], type: CONTENT_TAGS.MATCH_DAY });
  return [
    `MAÇ GÜNÜ | ${card.homeTeamName} - ${card.awayTeamName}`,
    header,
    `📅 ${card.dateLabel} · ⏰ ${card.timeLabel}`,
    `🏟️ ${card.stadiumLabel} · 🧑‍⚖️ ${card.refereeLabel}`,
    "",
    MATCH_DAY_QUESTION,
    "",
    tags,
  ]
    .filter((line, index) => index !== 1 || line.length > 0)
    .join("\n");
}
