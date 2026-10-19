import type { VitrinCard } from "@/types/vitrin";
import type { BlockFilter } from "../checkmatch-set/blocks";
import { AnalysisTemplate } from "./analysis";
import type { VitrinGeometry } from "./geometry";
import { PosterTemplate } from "./poster";

/**
 * MAÇ ÖNÜ VİTRİN carousel'i (AI_MARKET_PREDICTION) — CheckMatch set ailesi: sayfa etiketi + tarih,
 * künye + logo, tek vurgu rengi, gren (motor), çakışma kapısı (`layout-check.ts`).
 * 01 Poster (fotoğraflar, takımlar, kazanma çubuğu, manşet) · 02 Analiz (form, gösterge, bilet, kanca).
 */
export function VitrinTemplate({ card, g, only }: { card: VitrinCard; g: VitrinGeometry; only?: BlockFilter }) {
  return g.page === "poster" ? <PosterTemplate card={card} g={g} only={only} /> : <AnalysisTemplate card={card} g={g} only={only} />;
}
