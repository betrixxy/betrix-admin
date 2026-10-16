import type { MatchResultCard } from "@/types/match-result";
import { BODY, DISPLAY, px } from "../match-day/shared";
import type { ResultGeometry } from "./geometry";
import { Footer, ScoreStrip, ScorerColumns, Shade } from "./shared";

/**
 * KAHRAMAN-SKOR — MVP kesimi büyük ve net (sharp katmanı, bkz. `match-result-compose.ts`);
 * bu katman yalnızca alt %35'teki koyu gradyanı ve yazıları çizer: "MAÇIN OYUNCUSU" satırı,
 * ortasında turnuva logosu olan skor şeridi, iki sütun golcü listesi, künye + marka.
 * Beraberlik varyantında aynı yazı katmanı iki oyunculu split kompozisyonun üstüne basılır.
 */

function MvpLine({ card, size }: { card: MatchResultCard; size: number }) {
  if (!card.mvpName) return null;
  return (
    <div tw="flex items-center justify-center">
      <span style={{ fontFamily: BODY, fontWeight: 700, fontSize: size, letterSpacing: size * 0.32, color: card.accentHex }}>MAÇIN OYUNCUSU</span>
      <div tw="flex" style={{ width: 2, height: size, backgroundColor: "rgba(255,255,255,0.35)", margin: `0 ${size * 0.8}px` }} />
      <span style={{ fontFamily: DISPLAY, fontSize: size * 1.5, lineHeight: 1, letterSpacing: 1, color: "white" }}>{card.mvpName}</span>
    </div>
  );
}

function Vertical({ card, g }: { card: MatchResultCard; g: ResultGeometry }) {
  const { k, frame } = g;
  const logoHeight = px(34, k);
  const footerGap = px(34, k);
  return (
    <div tw="relative flex h-full w-full" style={{ fontFamily: BODY }}>
      <Shade g={g} />
      <div
        tw="absolute flex flex-col items-center"
        style={{ left: g.left, width: g.right - g.left, bottom: frame.height - (g.bottom - logoHeight - footerGap) }}
      >
        <MvpLine card={card} size={px(20, k)} />
        <div tw="flex" style={{ marginTop: px(22, k) }}>
          <ScoreStrip card={card} k={k} scoreSize={px(196, k)} />
        </div>
        <div tw="flex" style={{ marginTop: px(8, k) }}>
          <ScorerColumns card={card} width={g.right - g.left} size={px(24, k)} gap={px(124, k)} />
        </div>
      </div>
      <Footer card={card} g={g} size={px(16, k)} logoHeight={logoHeight} />
    </div>
  );
}

function Landscape({ card, g }: { card: MatchResultCard; g: ResultGeometry }) {
  const width = g.right - g.left;
  const strip = 0.62;
  return (
    <div tw="relative flex h-full w-full" style={{ fontFamily: BODY }}>
      <Shade g={g} />
      <div tw="absolute flex flex-col items-center justify-center" style={{ left: g.left, width, top: g.top, height: g.bottom - g.top - 40 }}>
        <MvpLine card={card} size={15} />
        <div tw="flex" style={{ marginTop: 18 }}>
          <ScoreStrip card={card} k={strip} scoreSize={150} />
        </div>
        <div tw="flex" style={{ marginTop: 4 }}>
          <ScorerColumns card={card} width={width} size={16} gap={60} />
        </div>
      </div>
      <Footer card={card} g={g} size={12} logoHeight={26} />
    </div>
  );
}

export function HeroScoreTemplate({ card, g }: { card: MatchResultCard; g: ResultGeometry }) {
  return g.frame.orientation === "landscape" ? <Landscape card={card} g={g} /> : <Vertical card={card} g={g} />;
}
