import type { MatchDayCard } from "@/types/match-day";
import { blockOpacity, type BlockFilter, type LayoutBlockId } from "../checkmatch-set/blocks";
import type { TemplateGeometry } from "./geometry";
import { BrandLogo, Canvas, Eyebrow, SERIF, TEXT_SHADOW, TeamLogo, clip, fitFontSize, known, px, upperReferee, upperStadium } from "./shared";

/**
 * EDITORIAL PORTRAIT — spor dergisi kapağı: dramatik stüdyo ışığında oyuncu portreleri,
 * serif takım adları kademeli dizilir ("Italy / vs / Türkiye"), künye açık harf aralıklı
 * küçük başlıklarla. Takım adları kullanıcının yazdığı haliyle (büyük harf zorlanmaz).
 */

/** Kartın blokları (yerleşim kapısı) — logo dahil her öğe birine aittir. */
export const EDITORIAL_PORTRAIT_BLOCKS = ["header-label", "headline", "footer-text", "footer-logo"] as const satisfies readonly LayoutBlockId[];

const shown = (only: BlockFilter, id: LayoutBlockId) => ({ opacity: blockOpacity(only, id) });

function Rule({ width }: { width: number }) {
  return <div tw="flex" style={{ width, height: 1, backgroundColor: "rgba(255,255,255,0.45)" }} />;
}

function Masthead({ card, k, width }: { card: MatchDayCard; k: number; width: number }) {
  return (
    <div tw="flex items-center justify-between" style={{ width }}>
      <div tw="flex items-center">
        <Rule width={px(70, k)} />
        <div tw="flex" style={{ margin: `0 ${px(18, k)}px` }}>
          <Eyebrow size={px(16, k)} color="white">MAÇ GÜNÜ</Eyebrow>
        </div>
        <Rule width={px(70, k)} />
      </div>
      <Eyebrow size={px(12, k)} color="rgba(255,255,255,0.7)">{card.weekLabel ?? ""}</Eyebrow>
    </div>
  );
}

function Names({ card, k, width }: { card: MatchDayCard; k: number; width: number }) {
  const size = Math.min(
    fitFontSize(card.homeTeamName, width * 0.9, px(124, k), 0.5),
    fitFontSize(card.awayTeamName, width * 0.9, px(124, k), 0.5),
  );
  const name = (text: string, align: "flex-start" | "flex-end") => (
    <div tw="flex" style={{ width, justifyContent: align }}>
      <span style={{ fontFamily: SERIF, fontSize: size, lineHeight: 0.98, color: "white", textShadow: TEXT_SHADOW }}>{text}</span>
    </div>
  );
  // Büyük adlarda "vs" satırlara sıkıca yaslanır (negatif boşluk); uzun adlar küçüldüğünde ise
  // "vs" okunur boyutta kalır ve satırlarla çakışmasın diye pozitif boşluk alır.
  const compact = size < px(80, k);
  const vsSize = Math.max(size * 0.42, px(22, k));
  const vsGap = compact ? Math.round(size * 0.15) : px(-6, k);
  return (
    <div tw="flex flex-col">
      {name(card.homeTeamName, "flex-start")}
      <div tw="flex" style={{ width, justifyContent: "center", margin: `${vsGap}px 0` }}>
        <span style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: vsSize, lineHeight: 1, color: "rgba(255,255,255,0.85)" }}>vs</span>
      </div>
      {name(card.awayTeamName, "flex-end")}
    </div>
  );
}

function Credits({ card, k }: { card: MatchDayCard; k: number }) {
  const line = [known(card.dateLabel), known(card.timeLabel)].filter(Boolean).join("  ·  ");
  const stadium = known(card.stadiumLabel);
  const referee = known(card.refereeLabel);
  // Stadyum ve hakem AD (köken kuralı), "HAKEM" Türkçe etiket.
  const sub = [stadium ? upperStadium(card, clip(stadium, 34)) : null, referee ? `HAKEM ${upperReferee(card)}` : null].filter(Boolean).join("  ·  ");
  return (
    <div tw="flex flex-col items-center">
      <div tw="flex items-center">
        <TeamLogo src={card.homeLogo} name={card.homeTeam} size={px(44, k)} />
        <div tw="flex flex-col items-center" style={{ margin: `0 ${px(24, k)}px` }}>
          {line ? <Eyebrow size={px(16, k)} color="white">{line.toLocaleUpperCase("tr-TR")}</Eyebrow> : null}
          {sub ? (
            <div tw="flex" style={{ marginTop: line ? px(6, k) : 0 }}>
              <Eyebrow size={px(11, k)} color="rgba(255,255,255,0.62)">{sub}</Eyebrow>
            </div>
          ) : null}
        </div>
        <TeamLogo src={card.awayLogo} name={card.awayTeam} size={px(44, k)} />
      </div>
    </div>
  );
}

function Vertical({ card, g, only }: { card: MatchDayCard; g: TemplateGeometry; only: BlockFilter }) {
  const { k } = g;
  const width = g.right - g.left;
  return (
    <Canvas>
      <div tw="absolute flex" style={{ left: g.left, top: g.top, ...shown(only, "header-label") }}>
        <Masthead card={card} k={k} width={width} />
      </div>
      <div tw="absolute flex" style={{ left: g.left, top: g.blockTop, ...shown(only, "headline") }}>
        <Names card={card} k={k} width={width} />
      </div>
      <div tw="absolute flex flex-col items-center" style={{ left: 0, right: 0, bottom: g.frame.height - g.bottom }}>
        <div tw="flex" style={shown(only, "footer-text")}>
          <Credits card={card} k={k} />
        </div>
        <div tw="flex" style={{ marginTop: px(18, k), ...shown(only, "footer-logo") }}>
          <BrandLogo card={card} height={px(26, k)} />
        </div>
      </div>
    </Canvas>
  );
}

function Landscape({ card, g, only }: { card: MatchDayCard; g: TemplateGeometry; only: BlockFilter }) {
  const left = 650;
  const width = g.right - left;
  return (
    <Canvas>
      <div tw="absolute flex flex-col" style={{ left, top: g.top, width }}>
        <div tw="flex" style={shown(only, "header-label")}>
          <Masthead card={card} k={0.8} width={width} />
        </div>
        <div tw="flex" style={{ marginTop: 56, ...shown(only, "headline") }}>
          <Names card={card} k={0.78} width={width} />
        </div>
        <div tw="flex" style={{ marginTop: 36, justifyContent: "center", ...shown(only, "footer-text") }}>
          <Credits card={card} k={0.72} />
        </div>
      </div>
      <div tw="absolute flex" style={{ right: g.left, bottom: 30, ...shown(only, "footer-logo") }}>
        <BrandLogo card={card} height={22} />
      </div>
    </Canvas>
  );
}

export function EditorialPortraitTemplate({ card, g, only }: { card: MatchDayCard; g: TemplateGeometry; only?: BlockFilter }) {
  return g.frame.orientation === "landscape" ? <Landscape card={card} g={g} only={only} /> : <Vertical card={card} g={g} only={only} />;
}
