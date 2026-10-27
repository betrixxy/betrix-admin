import type { H2HCard } from "@/types/player-h2h";
import type { BlockFilter } from "../checkmatch-set/blocks";
import { H2HCompareTemplate } from "./compare";
import type { H2HGeometry } from "./geometry";
import { H2HPosterTemplate } from "./poster";

/**
 * OYUNCU KARŞILAŞTIRMASI carousel'i (PLAYER_H2H) — CheckMatch set ailesi: sayfa etiketi + tarih,
 * künye + logo, gren (motor), çakışma kapısı (`layout-check.ts`). 01 Poster · 02 İstatistikler.
 */
export function H2HTemplate({ card, g, only }: { card: H2HCard; g: H2HGeometry; only?: BlockFilter }) {
  return g.page === "poster" ? <H2HPosterTemplate card={card} g={g} only={only} /> : <H2HCompareTemplate card={card} g={g} only={only} />;
}
