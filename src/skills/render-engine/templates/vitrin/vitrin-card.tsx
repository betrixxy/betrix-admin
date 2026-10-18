import type { VitrinCard } from "@/types/vitrin";
import type { BlockFilter } from "../checkmatch-set/blocks";
import { SetFooter, SetHeader } from "../checkmatch-set/set-parts";
import { BODY, px } from "../match-day/shared";
import { VITRIN_SIZES, type VitrinGeometry } from "./geometry";
import { Hook, LockedRow, OpenBox, TeamsRow, VitrinShade, type VitrinLayer } from "./parts";

/**
 * MAÇ ÖNÜ VİTRİN kartı (AI_MARKET_PREDICTION) — CheckMatch set sistemiyle: sayfa etiketi + tarih,
 * künye + logo, tek vurgu rengi, gren (motor), çakışma kapısı (`layout-check.ts`). İki açık kutu
 * (olasılık + gerekçe), üç kilitli kutu (başlık açık, cevap bulanık), alt kanca (link yok).
 * Dikeyde fotoğraf üstte, yığın altta; 16:9'da fotoğraf solda, yığın sağ sütunda.
 */
export function VitrinTemplate({ card, g, layer = "main", only }: { card: VitrinCard; g: VitrinGeometry; layer?: VitrinLayer; only?: BlockFilter }) {
  const s = VITRIN_SIZES;
  // Yer tutucu katmanında başlık ve künye çizilmez (yalnızca bulanıklaşacak metin).
  const chrome = layer === "main";
  return (
    <div tw="relative flex h-full w-full" style={{ fontFamily: BODY }}>
      <VitrinShade g={g} layer={layer} only={only} />
      {chrome ? <SetHeader card={card} box={g.box} k={g.k} only={only} /> : null}
      <TeamsRow card={card} g={g} layer={layer} only={only} />
      <OpenBox box={card.open[0]} slot={g.open[0]} card={card} g={g} id="open-1" layer={layer} only={only} />
      <OpenBox box={card.open[1]} slot={g.open[1]} card={card} g={g} id="open-2" layer={layer} only={only} />
      <LockedRow card={card} g={g} layer={layer} only={only} />
      <Hook card={card} g={g} layer={layer} only={only} />
      {chrome ? <SetFooter card={card} box={g.box} size={px(s.footerSize, g.k)} logoHeight={px(s.logoHeight, g.k)} only={only} /> : null}
    </div>
  );
}
