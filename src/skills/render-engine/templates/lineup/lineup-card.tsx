import type { LineupCardInput, LineupPalette } from "@/types/lineup";
import { BODY } from "../deep-analysis/deep-analysis-tokens";
import { LineupFooter, LineupHeader } from "./lineup-chrome";
import { LineupHeroList, type LineupHeroImage } from "./lineup-hero-list";
import { LineupPitch } from "./lineup-pitch";

/**
 * MUHTEMEL 11 / İLK 11 — tek takımlık kadro kartı (Satori, 1080×1350 / IG 4:5), iki şablon:
 *
 * - `pitch` (Taktik Tahtası): logodan türetilen gece zemininde, vurgu rengi çizgili saha üzerinde diziliş.
 * - `hero_list` (Kahraman Liste): solda kapak oyuncusunun kesimi (zorunlu), sağda numara + isim listesi.
 *
 * Renkler tamamen takım logosundan gelir (`palette`, bkz. lib/dashboard/lineup-palette.ts).
 * Katmanlar (alttan üste, bkz. CLAUDE.md 3.4): zemin → (varsa) kapak kesimi → okunabilirlik perdesi →
 * kadro (veri katmanı) → üstte başlık + logolar, altta CheckMatch imzası (marka katmanı, en üstte).
 */

export { LINEUP_CARD_SIZE } from "./lineup-chrome";
export type { LineupHeroImage } from "./lineup-hero-list";

/** Kapak yalnızca liste şablonunda vardır ve orada zorunludur — tip, kapaksız listeyi imkânsız kılar. */
type TemplateLayer = { templateStyle: "pitch"; hero: null } | { templateStyle: "hero_list"; hero: LineupHeroImage };

export type LineupCardData = Omit<LineupCardInput, "templateStyle"> &
  TemplateLayer & {
    /** CheckMatch logosu (".net"siz, data URL). */
    brandLogo: string;
    palette: LineupPalette;
  };

export function LineupCard(props: LineupCardData) {
  const { team, opponentName, opponentLogoUrl, headline, matchLabel, brandLogo, palette } = props;
  return (
    <div tw="relative flex h-full w-full" style={{ fontFamily: BODY, color: palette.text, backgroundColor: palette.backgroundBottom, overflow: "hidden" }}>
      {props.templateStyle === "hero_list" ? (
        <LineupHeroList formation={team.formation} slots={team.slots} palette={palette} hero={props.hero} />
      ) : (
        <LineupPitch formation={team.formation} slots={team.slots} palette={palette} />
      )}
      <LineupHeader headline={headline} teamName={team.teamName} opponentName={opponentName} logoUrl={team.logoUrl} opponentLogoUrl={opponentLogoUrl} palette={palette} />
      <LineupFooter brandLogo={brandLogo} formation={team.formation} matchLabel={matchLabel} coach={team.coach} palette={palette} />
    </div>
  );
}
