import { buildSetCard, resolveSetImages, type SetImages } from "@/lib/dashboard/checkmatch-set";
import { upperTr } from "@/lib/dashboard/match-result-labels";
import type { MatchResultCard, MatchResultFacts } from "@/types/match-result";

/** Kart görselleri — set kartlarıyla ortak. */
export type MatchResultImages = SetImages;

/**
 * Saf: gerçek maç verisi + seçilen MVP adı → şablon kartı. `pageLabel` ("01 · MAÇ SONUCU") yalnızca
 * set/carousel olarak paylaşılırken verilir; tek başına paylaşılan kartta null (etiket çizilmez).
 */
export function buildMatchResultCard(facts: MatchResultFacts, images: MatchResultImages, mvpName: string | null, pageLabel: string | null = null): MatchResultCard {
  return { ...buildSetCard(facts, images, pageLabel), mvpName: mvpName ? upperTr(mvpName) : null };
}

export async function resolveMatchResultCard(facts: MatchResultFacts, mvpName: string | null, pageLabel: string | null = null): Promise<MatchResultCard> {
  return buildMatchResultCard(facts, await resolveSetImages(facts), mvpName, pageLabel);
}
