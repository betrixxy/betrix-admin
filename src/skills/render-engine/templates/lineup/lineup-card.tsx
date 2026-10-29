import { upperTeamName } from "@/lib/dashboard/name-case";
import type { LineupCardInput, LineupPalette } from "@/types/lineup";
import { BODY } from "../deep-analysis/deep-analysis-tokens";
import { LineupFooter, LineupHeader } from "./lineup-chrome";
import { lineupGeometry } from "./lineup-geometry";
import { LineupHeroList, type LineupHeroImage } from "./lineup-hero-list";
import { LineupPitch } from "./lineup-pitch";

/**
 * MUHTEMEL 11 / İLK 11 — tek takımlık kadro kartı (Satori; boyut ve yerleşim seçilen formattan, bkz.
 * lineup-geometry.ts), iki şablon:
 *
 * - `pitch` (Taktik Tahtası): logodan türetilen gece zemininde, vurgu rengi çizgili saha üzerinde diziliş.
 * - `hero_list` (Kahraman Liste): solda kapak oyuncusunun kesimi (zorunlu), sağda numara + isim listesi.
 *
 * Renkler tamamen takım logosundan gelir (`palette`, bkz. lib/dashboard/lineup-palette.ts).
 * Katmanlar (alttan üste, bkz. CLAUDE.md 3.4): zemin → (varsa) kapak kesimi → okunabilirlik perdesi →
 * kadro (veri katmanı) → üstte başlık + logolar, altta CheckMatch imzası (marka katmanı, en üstte).
 */

export { lineupGeometry } from "./lineup-geometry";
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
  const { team, opponentName, opponentLogoUrl, headline, matchLabel, format, brandLogo, palette } = props;
  const g = lineupGeometry(format);
  // Adlar köken kuralıyla büyür (Türkçe büyük harf yalnızca Türk adlarına, bkz. name-case.ts).
  const people = props.origins?.team.people ?? null;
  const teamLabel = upperTeamName(team.teamName, props.origins?.team);
  const opponentLabel = opponentName ? upperTeamName(opponentName, props.origins?.opponent) : "";
  return (
    <div tw="relative flex h-full w-full" style={{ fontFamily: BODY, color: palette.text, backgroundColor: palette.backgroundBottom, overflow: "hidden" }}>
      {props.templateStyle === "hero_list" ? (
        <LineupHeroList g={g} formation={team.formation} slots={team.slots} palette={palette} hero={props.hero} peopleOrigin={people} />
      ) : (
        <LineupPitch g={g} formation={team.formation} slots={team.slots} palette={palette} peopleOrigin={people} />
      )}
      <LineupHeader g={g} headline={headline} teamName={teamLabel} opponentName={opponentLabel} logoUrl={team.logoUrl} opponentLogoUrl={opponentLogoUrl} palette={palette} />
      <LineupFooter g={g} brandLogo={brandLogo} formation={team.formation} matchLabel={matchLabel} coach={team.coach} palette={palette} />
    </div>
  );
}
