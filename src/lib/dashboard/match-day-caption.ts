import { CONTENT_TAGS, hashtagLine } from "@/lib/dashboard/caption-hashtags";
import type { MatchDayCard } from "@/types/match-day";

/**
 * Maç Günü gönderi metni — şablondan (LLM yok): başlık (yazıldığı hâliyle takım adları), künye, tarih/saat,
 * stadyum/hakem; sonunda etkileşim sorusu ve 3–5 hashtag (`caption-hashtags.ts`; büyük harfli lig künyesi
 * tablodan #SüperLig'e çözülür). Satır içi ayraç " · " (çift boşluk yok). Değeri olmayan alan (kart künyesinin
 * "—" işareti: stadyum, hakem, saat API'de yok) yazılmaz; satırın bütün alanları boşsa satır tamamen düşer
 * (canlı prova 2026-11-01, "🏟️ —"). Bekçi: `tests/unit/caption-empty-lines.test.ts`.
 */

export const MATCH_DAY_QUESTION = "Sizce kim kazanır? Yorumlara yazın 👇";

/** Kart künyesinin "değer yok" işareti (`match-day-assets.ts`). */
const MISSING = "—";

/** "🏟️ Değer · 🧑‍⚖️ Değer" — yalnızca değeri olan alanlar; hiçbiri yoksa null (satır düşer). */
function fieldLine(fields: [icon: string, value: string][]): string | null {
  const present = fields.map(([icon, value]) => [icon, value.trim()] as const).filter(([, value]) => value.length > 0 && value !== MISSING);
  return present.length > 0 ? present.map(([icon, value]) => `${icon} ${value}`).join(" · ") : null;
}

export function buildMatchDayCaption(card: MatchDayCard): string {
  const header = [card.weekLabel, card.leagueLabel].filter(Boolean).join(" · ");
  const tags = hashtagLine({ names: [card.homeTeamName, card.awayTeamName], competitions: [card.leagueLabel], type: CONTENT_TAGS.MATCH_DAY });
  return [
    `MAÇ GÜNÜ | ${card.homeTeamName} - ${card.awayTeamName}`,
    header.length > 0 ? header : null,
    fieldLine([["📅", card.dateLabel], ["⏰", card.timeLabel]]),
    fieldLine([["🏟️", card.stadiumLabel], ["🧑‍⚖️", card.refereeLabel]]),
    "",
    MATCH_DAY_QUESTION,
    "",
    tags,
  ]
    .filter((line): line is string => line !== null)
    .join("\n");
}
