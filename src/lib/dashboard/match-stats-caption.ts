import { matchResultTitle } from "@/lib/dashboard/match-result-caption";
import { formatStatValue, plainLabel, STAT_ROWS, summaryRowKeys } from "@/lib/dashboard/match-stats-rows";
import type { MatchStatsFacts } from "@/types/match-stats";

/**
 * Maç İstatistikleri gönderi metni taslağı — şablondan (LLM yok, bkz. CLAUDE.md 1.10): kartın
 * özet satırlarından ilk `LINES` tanesi, değerler kartla AYNI biçimlendirmeyle. Olmayan satır
 * yazılmaz; admin inceleme ekranında düzenler.
 */

const LINES = 4;

export function buildMatchStatsCaption(facts: MatchStatsFacts): string {
  const byKey = new Map(facts.rows.map((row) => [row.key, row]));
  const lines = summaryRowKeys(facts.rows)
    .map((key) => byKey.get(key))
    .filter((row) => row !== undefined)
    .slice(0, LINES)
    // Düz etiket: "Beklenen gol ({xG})" süslü parantezi yalnızca kart çizimi içindir (sızarsa ortak kapı durdurur).
    .map((row) => `📊 ${plainLabel(STAT_ROWS[row.key].label)}:${formatStatValue(row.key, row.home)} – ${formatStatValue(row.key, row.away)}`);
  return [`MAÇ İSTATİSTİKLERİ | ${matchResultTitle(facts)}`, `${facts.competition.name} · ${facts.roundLabel}`, ...lines].join("\n");
}
