import type { LineupCardInput } from "@/types/lineup";
import { BODY } from "../deep-analysis/deep-analysis-tokens";
import { DEEP, LineupFooter, LineupHeader, kitColor } from "./lineup-chrome";
import { LineupHeroList, type LineupHeroImage } from "./lineup-hero-list";
import { LineupPitch } from "./lineup-pitch";

/**
 * MUHTEMEL 11 / İLK 11 — tek takımlık kadro kartı (Satori, 1080×1350 / IG 4:5), iki şablon:
 *
 * - `pitch` (Taktik Tahtası): lacivert-yeşil çim + neon saha çizgileri üzerinde diziliş.
 * - `hero_list` (Kahraman Liste): solda kapak oyuncusunun kesimi, sağda saha çizgisiz numara + isim listesi.
 *
 * Katmanlar (alttan üste, bkz. CLAUDE.md 3.4): şablonun zemini → (varsa) kapak kesimi → okunabilirlik
 * perdesi → kadro (veri katmanı) → üstte başlık + logolar, altta CheckMatch imzası (marka katmanı, en üstte).
 */

export { LINEUP_CARD_SIZE } from "./lineup-chrome";
export type { LineupHeroImage } from "./lineup-hero-list";

export interface LineupCardData extends LineupCardInput {
  /** CheckMatch logosu (".net"siz, data URL). */
  brandLogo: string;
  /** Yalnızca `hero_list` şablonu çizer. */
  hero: LineupHeroImage | null;
}

export function LineupCard({ templateStyle, team, opponentName, opponentLogoUrl, headline, matchLabel, brandLogo, hero }: LineupCardData) {
  const colorHex = kitColor(team.colorHex);
  return (
    <div tw="relative flex h-full w-full" style={{ fontFamily: BODY, color: "white", backgroundColor: DEEP, overflow: "hidden" }}>
      {templateStyle === "hero_list" ? (
        <LineupHeroList formation={team.formation} slots={team.slots} colorHex={colorHex} hero={hero} />
      ) : (
        <LineupPitch formation={team.formation} slots={team.slots} colorHex={colorHex} />
      )}
      <LineupHeader headline={headline} teamName={team.teamName} opponentName={opponentName} logoUrl={team.logoUrl} opponentLogoUrl={opponentLogoUrl} />
      <LineupFooter brandLogo={brandLogo} formation={team.formation} matchLabel={matchLabel} coach={team.coach} />
    </div>
  );
}
