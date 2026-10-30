import type { AnalysisEvent } from "@/types/match-analysis";

/**
 * Zaman çizelgesinin YOĞUNLUK kuralı (saf, deterministik) — kalabalık maç da yerleşim kapısından geçsin:
 *  1. Aynı takımın AYNI dakikadaki (uzatma dakikası dahil) değişiklikleri her zaman tek satırda birleşir
 *     ("3 DEĞİŞİKLİK" + girenler).
 *  2. Satırlar formata sığmıyorsa (`fits`) önce bütün değişiklik satırları düşer, dipnotta sayısıyla yazılır.
 *  3. Hâlâ sığmıyorsa sarı kartlar da düşer (dipnotta sayısıyla). Goller, kaçan penaltı, kırmızı kartlar ve
 *     VAR kararları ASLA düşmez — yine sığmıyorsa satırlar en küçük yüksekliğe iner, o da yetmezse yerleşim
 *     kapısı kartı durdurur ve sebebi yazar.
 */

export interface TimelinePlan {
  /** Satır grupları (çoğu tek olay; birleşik değişiklikte birden çok). */
  groups: AnalysisEvent[][];
  omitted: { substitutions: number; yellows: number };
}

const sameSlot = (a: AnalysisEvent, b: AnalysisEvent) => a.side === b.side && a.elapsed === b.elapsed && a.extra === b.extra;

/** Kural 1: ardışık + aynı takım + aynı dakika değişiklikleri birleşir (araya başka olay girerse ayrı satır). */
export function mergeSubstitutions(events: readonly AnalysisEvent[]): AnalysisEvent[][] {
  const groups: AnalysisEvent[][] = [];
  for (const event of events) {
    const last = groups.at(-1);
    const head = last?.[0];
    if (last && head && event.kind === "SUBSTITUTION" && head.kind === "SUBSTITUTION" && sameSlot(head, event)) last.push(event);
    else groups.push([event]);
  }
  return groups;
}

const count = (groups: AnalysisEvent[][], kind: AnalysisEvent["kind"]) => groups.reduce((sum, group) => sum + group.filter((event) => event.kind === kind).length, 0);

export function planTimeline(events: readonly AnalysisEvent[], fits: (groups: AnalysisEvent[][]) => boolean): TimelinePlan {
  let groups = mergeSubstitutions(events);
  const omitted = { substitutions: 0, yellows: 0 };
  if (fits(groups)) return { groups, omitted };
  omitted.substitutions = count(groups, "SUBSTITUTION");
  groups = groups.filter((group) => group[0]?.kind !== "SUBSTITUTION");
  if (fits(groups)) return { groups, omitted };
  omitted.yellows = count(groups, "YELLOW");
  groups = groups.filter((group) => group[0]?.kind !== "YELLOW");
  return { groups, omitted };
}
