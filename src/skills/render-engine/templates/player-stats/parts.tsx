import type { SpotlightCard, TopPlayersCard } from "@/types/player-match-stats";
import { BRAND_LOGO_ALT, brandLogoWidth } from "../brand";
import { blockOpacity, layerOpacity, stackLayer, STACK_LAYERS, type BlockFilter } from "../checkmatch-set/blocks";
import { SetHeader } from "../checkmatch-set/set-parts";
import { BODY, fitFontSize, px } from "../match-day/shared";
import { MUTED, TEXT_SHADOW } from "../vitrin/parts";
import { PLAYER_SIZES, type PlayerFrame } from "./geometry";

/**
 * Oyuncu İstatistikleri ortak parçaları (Satori): sayfa etiketi (set ile aynı bileşen; tarih künyede),
 * iki satırlık künye ("MILAN 2–4 BOLOGNA" / "SERIE A · 9. HAFTA · 28.10.2026") + CheckMatch logosu sağ altta,
 * veri kaynağı dipnotu. Alt alta satırlar mürekkep katmanıdır (`stack-a` / `stack-b`).
 */

type CardBase = Pick<SpotlightCard | TopPlayersCard, "accentHex" | "pageLabel" | "matchLine" | "metaLine" | "footnote" | "brandLogo">;

export function PlayerHeader({ card, g, only }: { card: CardBase; g: PlayerFrame; only: BlockFilter }) {
  if (!card.pageLabel) return null;
  return <SetHeader card={{ pageLabel: card.pageLabel, dateLabel: "", accentHex: card.accentHex }} box={g.box} k={g.frame.orientation === "landscape" ? 0.8 : g.k} only={only} />;
}

export function PlayerFooter({ card, g, only }: { card: CardBase; g: PlayerFrame; only: BlockFilter }) {
  const s = PLAYER_SIZES;
  const { k, panel } = g;
  const logoHeight = px(s.logo, k);
  const width = panel.right - panel.left - brandLogoWidth(logoHeight) - px(28, k);
  const matchSize = fitFontSize(card.matchLine, width, px(s.footerMatch, k), 0.74, px(12, k));
  const metaSize = fitFontSize(card.metaLine, width, px(s.footerMeta, k), 0.78, px(10, k));
  const line = { fontFamily: BODY, lineHeight: 1, textShadow: TEXT_SHADOW };
  return (
    <>
      <div tw="absolute flex flex-col" style={{ left: panel.left, top: g.footer.top, width, height: g.footer.height, justifyContent: "flex-end", opacity: blockOpacity(only, "footer-text", STACK_LAYERS) }}>
        <span style={{ ...line, fontWeight: 800, fontSize: matchSize, letterSpacing: matchSize * 0.06, color: "#fff", opacity: layerOpacity(only, stackLayer(0)) }}>{card.matchLine}</span>
        <span style={{ ...line, fontWeight: 700, fontSize: metaSize, letterSpacing: metaSize * 0.12, color: "rgba(255,255,255,0.8)", marginTop: px(s.footerLineGap, k) + px(s.footerMeta, k) - metaSize, opacity: layerOpacity(only, stackLayer(1)) }}>{card.metaLine}</span>
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element -- Satori yalnızca düz <img> okur. */}
      <img
        src={card.brandLogo}
        alt={BRAND_LOGO_ALT}
        width={brandLogoWidth(logoHeight)}
        height={logoHeight}
        style={{ position: "absolute", left: panel.right - brandLogoWidth(logoHeight), top: g.footer.top + g.footer.height - logoHeight, opacity: blockOpacity(only, "footer-logo") }}
      />
    </>
  );
}

export function PlayerFootnote({ card, g, only }: { card: CardBase; g: PlayerFrame; only: BlockFilter }) {
  const size = px(PLAYER_SIZES.footnote, g.k);
  return (
    <div tw="absolute flex items-center" style={{ left: g.panel.left, top: g.footnote.top, width: g.panel.right - g.panel.left, height: g.footnote.height, opacity: blockOpacity(only, "footnote") }}>
      <span style={{ fontFamily: BODY, fontWeight: 600, fontSize: size, lineHeight: 1, letterSpacing: size * 0.04, color: MUTED }}>{card.footnote}</span>
    </div>
  );
}
