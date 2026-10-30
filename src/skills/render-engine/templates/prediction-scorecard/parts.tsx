import type { SettledStatus } from "@/types/prediction-scorecard";
import type { ScorecardCard } from "@/types/prediction-scorecard-card";
import { BRAND_LOGO_ALT, brandLogoWidth } from "../brand";
import { blockOpacity, layerOpacity, stackLayer, STACK_LAYERS, unlayered, type BlockFilter } from "../checkmatch-set/blocks";
import { BODY, DISPLAY, DISPLAY_DESCENT_EM, fitFontSize, px } from "../match-day/shared";
import { MUTED, Percent, percentWidth, TEXT_SHADOW } from "../vitrin/parts";
import { SCORECARD_SIZES, type ScorecardGeometry } from "./geometry";

/**
 * Tahmin Karnesi ortak parçaları (Satori). ✅/❌ emoji fontu Satori'de yok — işaretler çizilmiş SVG'dir
 * (yeşil daire + onay, kırmızı daire + çarpı; kilit ikonu ile aynı yol). Renkler anlamsaldır (tuttu / tutmadı),
 * takım ya da marka rengi değildir.
 */

export const HIT_HEX = "#2ED47A";
export const MISS_HEX = "#FF5C5C";
export const statusHex = (status: SettledStatus): string => (status === "HIT" ? HIT_HEX : MISS_HEX);

/** ✅ / ❌ — çizilmiş işaret. */
export function StatusIcon({ status, size }: { status: SettledStatus; size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="11" fill={statusHex(status)} />
      {status === "HIT" ? (
        <path d="M6.6 12.4l3.6 3.6 7.2-7.6" stroke="#07080C" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
      ) : (
        <path d="M8 8l8 8M16 8l-8 8" stroke="#07080C" strokeWidth="2.8" strokeLinecap="round" />
      )}
    </svg>
  );
}

type Props = { card: ScorecardCard; g: ScorecardGeometry; only: BlockFilter };

/** Üst satır + başlık + alt başlık — üç ayrı blok (Anton kuyruğu alt satıra binmez). */
export function ScorecardHead({ card, g, only }: Props) {
  const s = SCORECARD_SIZES;
  const width = g.head.right - g.head.left;
  const kicker = px(s.kicker, g.k);
  const title = fitFontSize(card.title, width, px(s.title, g.k), 0.47, px(40, g.k));
  const subtitle = fitFontSize(card.subtitle, width, px(s.subtitle, g.k), 0.68, px(14, g.k));
  return (
    <>
      <div tw="absolute flex items-center" style={{ left: g.head.left, top: g.kicker.top, width, height: g.kicker.height, opacity: blockOpacity(only, "header-label") }}>
        <span style={{ fontFamily: BODY, fontWeight: 800, fontSize: kicker, lineHeight: 1, letterSpacing: kicker * 0.24, color: "rgba(255,255,255,0.78)" }}>{card.kicker}</span>
      </div>
      <div tw="absolute flex items-start" style={{ left: g.head.left, top: g.title.top, width, height: g.title.height, opacity: blockOpacity(only, "title") }}>
        <span style={{ fontFamily: DISPLAY, fontSize: title, lineHeight: 1, letterSpacing: title * 0.01, color: "#fff", textShadow: TEXT_SHADOW }}>{card.title}</span>
      </div>
      <div tw="absolute flex items-center" style={{ left: g.head.left, top: g.subtitle.top, width, height: g.subtitle.height, opacity: blockOpacity(only, "headline") }}>
        <span style={{ fontFamily: BODY, fontWeight: 800, fontSize: subtitle, lineHeight: 1, letterSpacing: subtitle * 0.06, color: "#fff", textShadow: TEXT_SHADOW }}>{card.subtitle}</span>
      </div>
    </>
  );
}

/** Büyük isabet özeti: dev yüzde + "İSABET ORANI · …" ya da dev "3 TAHMİNDE 2 TUTTU" + "İLK TAHMİNLER". */
export function ScorecardHero({ card, g, only }: Props) {
  const s = SCORECARD_SIZES;
  const width = g.head.right - g.head.left;
  const line = px(s.heroLine, g.k);
  const lineStyle = { fontFamily: BODY, fontWeight: 800, fontSize: line, lineHeight: 1, letterSpacing: line * 0.16 };
  const { hero } = card;
  // Satori'de Fragment satır (row) kabı gibi dizilir — iki satır kabın DOĞRUDAN çocuklarıdır.
  const big =
    hero.kind === "RATE" ? (
      <div tw="flex" style={{ width: percentWidth(hero.percent, px(s.ratePercent, g.k)), textShadow: TEXT_SHADOW, opacity: layerOpacity(only, stackLayer(0)) }}>
        <Percent value={hero.percent} size={px(s.ratePercent, g.k)} color="#fff" />
      </div>
    ) : (
      <span style={{ fontFamily: DISPLAY, fontSize: fitFontSize(hero.text, width, px(s.smallText, g.k), 0.47, px(28, g.k)), lineHeight: 1, color: "#fff", textShadow: TEXT_SHADOW, opacity: layerOpacity(only, stackLayer(0)) }}>{hero.text}</span>
    );
  const sub =
    hero.kind === "RATE" ? (
      <span style={{ ...lineStyle, fontSize: fitFontSize(hero.line, width, line, 0.8, px(11, g.k)), color: MUTED, marginTop: px(s.heroLineGap, g.k), opacity: layerOpacity(only, stackLayer(1)) }}>{hero.line}</span>
    ) : hero.badge ? (
      <div tw="flex" style={{ marginTop: px(s.smallText * DISPLAY_DESCENT_EM + s.heroLineGap, g.k), opacity: layerOpacity(only, stackLayer(1)) }}>
        <span style={{ ...lineStyle, color: "#07080C", backgroundColor: "rgba(255,255,255,0.88)", padding: `${Math.round(line * 0.28)}px ${Math.round(line * 0.6)}px`, borderRadius: Math.round(line * 0.3) }}>{hero.badge}</span>
      </div>
    ) : null;
  return (
    <div tw="absolute flex flex-col" style={{ left: g.head.left, top: g.hero.top, width, height: g.hero.height, opacity: blockOpacity(only, "karne-hero", STACK_LAYERS) }}>
      {big}
      {sub}
    </div>
  );
}

/** ✅/❌ şeridi — eskiden yeniye, sabit adımlı. */
export function ScorecardStrip({ card, g, only }: Props) {
  const size = g.strip.height;
  const gap = Math.round(size * 0.22);
  return (
    <div tw="absolute flex items-center" style={{ left: g.head.left, top: g.strip.top, width: g.head.right - g.head.left, height: size, opacity: blockOpacity(only, "karne-strip") }}>
      {card.strip.map((status, index) => (
        <div key={index} tw="flex" style={{ marginRight: gap, opacity: unlayered(only) }}>
          <StatusIcon status={status} size={size} />
        </div>
      ))}
    </div>
  );
}

/** Dipnot (sol / tam genişlik) + künye satırı ve CheckMatch logosu sağ altta. */
export function ScorecardFooter({ card, g, only }: Props) {
  const s = SCORECARD_SIZES;
  const logoHeight = px(s.logo, g.k);
  const logoWidth = brandLogoWidth(logoHeight);
  const footnoteWidth = g.head.right - g.head.left;
  const footerWidth = g.box.right - g.box.left - logoWidth - px(28, g.k);
  const footer = fitFontSize(card.footerLine, footerWidth, px(s.footer, g.k), 0.82, px(10, g.k));
  const footnote = fitFontSize(card.footnote, footnoteWidth, px(s.footnote, g.k), 0.56, px(10, g.k));
  return (
    <>
      <div tw="absolute flex items-center" style={{ left: g.box.left, top: g.footnote.top, width: footnoteWidth, height: g.footnote.height, opacity: blockOpacity(only, "footnote") }}>
        <span style={{ fontFamily: BODY, fontWeight: 600, fontSize: footnote, lineHeight: 1, letterSpacing: footnote * 0.04, color: MUTED }}>{card.footnote}</span>
      </div>
      <div tw="absolute flex items-end" style={{ left: g.box.left, top: g.footer.top, width: footerWidth, height: g.footer.height, opacity: blockOpacity(only, "footer-text") }}>
        <span style={{ fontFamily: BODY, fontWeight: 800, fontSize: footer, lineHeight: 1, letterSpacing: footer * 0.12, color: "rgba(255,255,255,0.86)", textShadow: TEXT_SHADOW }}>{card.footerLine}</span>
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element -- Satori yalnızca düz <img> okur. */}
      <img src={card.brandLogo} alt={BRAND_LOGO_ALT} width={logoWidth} height={logoHeight} style={{ position: "absolute", left: g.box.right - logoWidth, top: g.footer.top, opacity: blockOpacity(only, "footer-logo") }} />
    </>
  );
}
