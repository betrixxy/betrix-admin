import { upperTeamName } from "@/lib/dashboard/name-case";
import type { LineupCardInput, LineupPalette } from "@/types/lineup";
import type { BlockFilter } from "../checkmatch-set/blocks";
import { BODY } from "../studio-tokens";
import { LineupFooter, LineupHeader } from "./lineup-chrome";
import { lineupGeometry } from "./lineup-geometry";
import { LineupHeroList } from "./lineup-hero-list";
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

/**
 * Kapak yalnızca liste şablonunda vardır ve orada zorunludur; fotoğraf bu katmanın altındaki sanat
 * katmanında çizilir (render tarafı kapak yoksa taktik tahtasına düşer).
 */
export type LineupCardData = Omit<LineupCardInput, "heroPhoto"> & {
    /** CheckMatch logosu (".net"siz, data URL). */
    brandLogo: string;
    palette: LineupPalette;
    /** Yerleşim kapısı: yalnızca bu blok görünür (bkz. `lineup-chrome.tsx::LINEUP_BLOCKS`). */
    only?: BlockFilter | undefined;
  };

export function LineupCard(props: LineupCardData) {
  const { team, opponentName, opponentLogoUrl, headline, matchLabel, format, brandLogo, palette, only } = props;
  const g = lineupGeometry(format);
  const hero = props.templateStyle === "hero_list";
  // Adlar köken kuralıyla büyür (Türkçe büyük harf yalnızca Türk adlarına, bkz. name-case.ts).
  const people = props.origins?.team.people ?? null;
  const teamLabel = upperTeamName(team.teamName, props.origins?.team);
  const opponentLabel = opponentName ? upperTeamName(opponentName, props.origins?.opponent) : "";
  return (
    // Kahraman Liste: zemin + kapak alttaki sanat katmanında — bu katman saydam.
    <div tw="relative flex h-full w-full" style={{ fontFamily: BODY, color: palette.text, backgroundColor: only || hero ? "transparent" : palette.backgroundBottom, overflow: "hidden" }}>
      {hero ? (
        <LineupHeroList g={g} formation={team.formation} slots={team.slots} palette={palette} peopleOrigin={people} only={only} />
      ) : (
        <LineupPitch g={g} formation={team.formation} slots={team.slots} palette={palette} peopleOrigin={people} only={only} />
      )}
      <LineupHeader g={g} headline={headline} teamName={teamLabel} opponentName={opponentLabel} logoUrl={team.logoUrl} opponentLogoUrl={opponentLogoUrl} palette={palette} only={only} />
      <LineupFooter g={g} brandLogo={brandLogo} formation={team.formation} matchLabel={matchLabel} coach={team.coach} palette={palette} only={only} />
    </div>
  );
}
