import { buildSetCard, resolveSetImages, type SetImages } from "@/lib/dashboard/checkmatch-set";
import { upperTr } from "@/lib/dashboard/match-result-labels";
import { statsHighlight } from "@/lib/dashboard/match-stats-highlight";
import { formatStatValue, isRowVisible, SECTION_LABELS, STAT_ROWS, statBar, statTones } from "@/lib/dashboard/match-stats-rows";
import { statsPalette } from "@/lib/dashboard/match-stats-theme";
import { STAT_SECTIONS, type MatchStatsCard, type MatchStatsFacts, type MatchStatsPage, type StatCardRow, type StatCardSection, type StatRowValue } from "@/types/match-stats";

/** Kart görselleri — set kartlarıyla ortak. */
export type MatchStatsImages = SetImages;

function cardRow(value: StatRowValue): StatCardRow {
  const tones = statTones(value);
  return {
    key: value.key,
    label: STAT_ROWS[value.key].label,
    homeText: formatStatValue(value.key, value.home),
    awayText: formatStatValue(value.key, value.away),
    bar: statBar(value),
    homeTone: tones.home,
    awayTone: tones.away,
  };
}

/**
 * Sayfanın bölümleri. Özet: `summaryOrder`'lı satırlar, başlıksız tek liste. Detay: kalan satırlar
 * Hücum / Pas / Savunma / Disiplin başlıklarıyla; boş bölüm çizilmez.
 */
export function statSections(facts: MatchStatsFacts, page: MatchStatsPage): StatCardSection[] {
  const visible = facts.rows.filter(isRowVisible);
  if (page === "SUMMARY") {
    const rows = visible
      .filter((value) => STAT_ROWS[value.key].summaryOrder !== null)
      .sort((a, b) => (STAT_ROWS[a.key].summaryOrder ?? 0) - (STAT_ROWS[b.key].summaryOrder ?? 0));
    return [{ title: null, rows: rows.map(cardRow) }];
  }
  return STAT_SECTIONS.map((section) => ({
    title: upperTr(SECTION_LABELS[section]),
    rows: visible.filter((value) => STAT_ROWS[value.key].summaryOrder === null && STAT_ROWS[value.key].section === section).map(cardRow),
  })).filter((section) => section.rows.length > 0);
}

/**
 * Saf: gerçek maç verisi + sayfa → şablon kartı. Skor/golcü/vurgu rengi set alanlarıdır (Maç Sonucu
 * ile aynı kaynak); takım renkleri yalnızca çubuklara gider. `pageLabel`: "02 · İSTATİSTİKLER",
 * tek başına paylaşılırken null.
 */
export function buildMatchStatsCard(facts: MatchStatsFacts, page: MatchStatsPage, images: MatchStatsImages, pageLabel: string | null): MatchStatsCard {
  const { homeHex, awayHex } = statsPalette(facts);
  return {
    ...buildSetCard(facts, images, pageLabel),
    page,
    highlight: statsHighlight(facts),
    homeHex,
    awayHex,
    sections: statSections(facts, page),
  };
}

export const resolveMatchStatsImages = (facts: MatchStatsFacts): Promise<MatchStatsImages> => resolveSetImages(facts);
