import { buildSetCard, resolveSetImages, type SetImages } from "@/lib/dashboard/checkmatch-set";
import { upperTr } from "@/lib/dashboard/match-result-labels";
import { statsHighlight } from "@/lib/dashboard/match-stats-highlight";
import { formatStatValue, isRowVisible, SECTION_LABELS, STAT_ROWS, statBar, statTones, summaryRowKeys, upperLabel, XG_FOOTNOTE } from "@/lib/dashboard/match-stats-rows";
import { statsPalette } from "@/lib/dashboard/match-stats-theme";
import { STAT_SECTIONS, type MatchStatsCard, type MatchStatsFacts, type MatchStatsPage, type StatCardRow, type StatCardSection, type StatRowValue } from "@/types/match-stats";

/** Kart görselleri — set kartlarıyla ortak. */
export type MatchStatsImages = SetImages;

function cardRow(value: StatRowValue): StatCardRow {
  const tones = statTones(value);
  return {
    key: value.key,
    label: upperLabel(STAT_ROWS[value.key].label),
    homeText: formatStatValue(value.key, value.home),
    awayText: formatStatValue(value.key, value.away),
    bar: statBar(value),
    homeTone: tones.home,
    awayTone: tones.away,
  };
}

/**
 * Sayfanın bölümleri. Özet: öncelik listesi + yedeklerle en fazla 8 satır (`summaryRowKeys`),
 * başlıksız tek liste. Detay: özette kullanılmayan satırlar Hücum / Pas / Savunma / Disiplin
 * başlıklarıyla; boş bölüm çizilmez.
 */
export function statSections(facts: MatchStatsFacts, page: MatchStatsPage): StatCardSection[] {
  const visible = facts.rows.filter(isRowVisible);
  const summaryKeys = summaryRowKeys(facts.rows);
  if (page === "SUMMARY") {
    const byKey = new Map(visible.map((value) => [value.key, value]));
    const rows = summaryKeys.map((key) => byKey.get(key)).filter((value): value is StatRowValue => value !== undefined);
    return [{ title: null, rows: rows.map(cardRow) }];
  }
  const used = new Set(summaryKeys);
  return STAT_SECTIONS.map((section) => ({
    title: upperTr(SECTION_LABELS[section]),
    rows: visible.filter((value) => !used.has(value.key) && STAT_ROWS[value.key].section === section).map(cardRow),
  })).filter((section) => section.rows.length > 0);
}

/** xG satırı özetteyse dipnot; Detay sayfasında ve xG yokken null. */
export function statsFootnote(sections: StatCardSection[], page: MatchStatsPage): string | null {
  return page === "SUMMARY" && sections.some((section) => section.rows.some((row) => row.key === "xg")) ? XG_FOOTNOTE : null;
}

/**
 * Saf: gerçek maç verisi + sayfa → şablon kartı. Skor/golcü/vurgu rengi set alanlarıdır (Maç Sonucu
 * ile aynı kaynak); takım renkleri yalnızca çubuklara gider. `pageLabel`: "02 · İSTATİSTİKLER",
 * tek başına paylaşılırken null.
 */
export function buildMatchStatsCard(facts: MatchStatsFacts, page: MatchStatsPage, images: MatchStatsImages, pageLabel: string | null): MatchStatsCard {
  const { homeHex, awayHex } = statsPalette(facts);
  const sections = statSections(facts, page);
  return {
    ...buildSetCard(facts, images, pageLabel),
    page,
    highlight: statsHighlight(facts),
    homeHex,
    awayHex,
    sections,
    footnote: statsFootnote(sections, page),
  };
}

export const resolveMatchStatsImages = (facts: MatchStatsFacts): Promise<MatchStatsImages> => resolveSetImages(facts);
