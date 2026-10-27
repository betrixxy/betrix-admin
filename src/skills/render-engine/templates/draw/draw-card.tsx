import type { DrawCard } from "@/types/draw";
import type { BlockFilter } from "../checkmatch-set/blocks";
import { DrawAllTemplate } from "./all";
import type { DrawGeometry } from "./geometry";
import { DrawGridTemplate } from "./grid";
import { DrawPosterTemplate } from "./poster";
import { DrawTurkishTemplate } from "./turkish";

/**
 * KURA SONUCU (DRAWS_AND_PAIRINGS) — CheckMatch set ailesi: sayfa etiketi + tarih, künye (turnuva · tur ·
 * kura tarihi) + logo, gren (motor), çakışma kapısı. A: poster (+ lig aşamasında 02 rakip ızgarası) ·
 * B: temsilcilerimiz · C: tüm eşleşmeler. `page`: carousel'de 0 ya da 1.
 */
export function DrawTemplate({ card, g, page, only }: { card: DrawCard; g: DrawGeometry; page: number; only?: BlockFilter }) {
  const { body } = card;
  if (g.page === "poster") return <DrawPosterTemplate card={card} g={g} only={only} />;
  if (body.kind === "TEAM_LEAGUE" && page === 1) return <DrawGridTemplate card={card} body={body} g={g} only={only} />;
  if (body.kind === "TURKISH") return <DrawTurkishTemplate card={card} body={body} g={g} only={only} />;
  if (body.kind === "ALL") return <DrawAllTemplate card={card} body={body} g={g} only={only} />;
  return null;
}
