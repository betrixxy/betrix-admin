import { buildSetCard, resolveSetImages, type SetImages } from "@/lib/dashboard/checkmatch-set";
import { upperName, type NameOrigin } from "@/lib/dashboard/name-case";
import type { MatchResultCard, MatchResultFacts } from "@/types/match-result";

/** Kart görselleri — set kartlarıyla ortak. */
export type MatchResultImages = SetImages;

/**
 * Saf: gerçek maç verisi + seçilen MVP adı → şablon kartı. `pageLabel` ("01 · MAÇ SONUCU") yalnızca
 * set/carousel olarak paylaşılırken verilir; tek başına paylaşılan kartta null (etiket çizilmez).
 */
export function buildMatchResultCard(facts: MatchResultFacts, images: MatchResultImages, mvpName: string | null, pageLabel: string | null = null, mvpOrigin: NameOrigin | null = null): MatchResultCard {
  // MVP adı: kendi harfleri → uyruğu (`set-people.ts`) → oynadığı tarafın kişi kökeni (MVP kazanandan seçilir).
  const side = facts.mvp?.side ?? (facts.outcome === "AWAY" ? "AWAY" : "HOME");
  const origin = (side === "AWAY" ? facts.away : facts.home).origin;
  return { ...buildSetCard(facts, images, pageLabel), mvpName: mvpName ? upperName(mvpName, mvpOrigin ?? origin?.people) : null };
}

export async function resolveMatchResultCard(facts: MatchResultFacts, mvpName: string | null, pageLabel: string | null = null, mvpOrigin: NameOrigin | null = null): Promise<MatchResultCard> {
  return buildMatchResultCard(facts, await resolveSetImages(facts), mvpName, pageLabel, mvpOrigin);
}
