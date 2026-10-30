import { CONTENT_TAGS, hashtagLine } from "@/lib/dashboard/caption-hashtags";
import { matchResultTitle } from "@/lib/dashboard/match-result-caption";
import { formatStatValue, plainLabel, STAT_ROWS, summaryRowKeys } from "@/lib/dashboard/match-stats-rows";
import type { MatchStatsFacts } from "@/types/match-stats";

/**
 * Maç İstatistikleri gönderi metni taslağı — şablondan (LLM yok, bkz. CLAUDE.md 1.10): kartın
 * özet satırlarından ilk `LINES` tanesi, değerler kartla AYNI biçimlendirmeyle ("Top hakimiyeti: %46 – %54";
 * iki noktadan sonra boşluk). Olmayan satır yazılmaz; sonunda etkileşim sorusu ve 3–5 hashtag.
 */

const LINES = 4;
export const STATS_QUESTION = "Sizce istatistikler skoru yansıtıyor mu? Yorumlara yazın 👇";

export function buildMatchStatsCaption(facts: MatchStatsFacts): string {
  const byKey = new Map(facts.rows.map((row) => [row.key, row]));
  const lines = summaryRowKeys(facts.rows)
    .map((key) => byKey.get(key))
    .filter((row) => row !== undefined)
    .slice(0, LINES)
    // Düz etiket: "Beklenen gol ({xG})" süslü parantezi yalnızca kart çizimi içindir (sızarsa ortak kapı durdurur).
    .map((row) => `📊 ${plainLabel(STAT_ROWS[row.key].label)}: ${formatStatValue(row.key, row.home)} – ${formatStatValue(row.key, row.away)}`);
  const tags = hashtagLine({ names: [facts.home.name, facts.away.name], competitions: [facts.competition.name], type: CONTENT_TAGS.MATCH_STATS });
  return [`MAÇ İSTATİSTİKLERİ | ${matchResultTitle(facts)}`, `${facts.competition.name} · ${facts.roundLabel}`, ...lines, "", STATS_QUESTION, "", tags].join("\n");
}
