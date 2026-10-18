import type { MatchResultCard } from "@/types/match-result";
import { SetHeader, ScoreStrip, ScorerColumns, SET_VERTICAL, SetFooter, SetScoreBlock } from "../checkmatch-set/set-parts";
import { BODY, px } from "../match-day/shared";
import type { ResultGeometry } from "./geometry";
import { MvpLine } from "./hero-score";
import { Shade } from "./shared";

/**
 * A · TAM KADRAJ — gerçek maç fotoğrafı tüm kartı kaplar (sharp katmanı: akıllı kırpma + tonlama,
 * bkz. `lib/dashboard/match-photo/`). Bu katman yalnızca okunurluk gradyanını ve set yazılarını
 * çizer: alttaki skor şeridi + golcüler set bloğudur (`SetScoreBlock`), 02 İstatistik kartıyla
 * birebir aynı yerde durur. "MAÇIN OYUNCUSU" satırı isteğe bağlıdır (yuva sabit, şerit kaymaz).
 * Gradyan gücü fotoğrafın yazı bölgesinde ölçülen parlaklıktan gelir (`shadeStrength`).
 */

function Vertical({ card, g, shadeStrength }: { card: MatchResultCard; g: ResultGeometry; shadeStrength: number }) {
  const { k, frame } = g;
  return (
    <div tw="relative flex h-full w-full" style={{ fontFamily: BODY }}>
      <Shade g={g} strength={shadeStrength} />
      <SetHeader card={card} box={g} k={k} />
      <SetScoreBlock card={card} box={g} frameHeight={frame.height} k={k} headline={<MvpLine card={card} size={px(20, k)} />} />
      <SetFooter card={card} box={g} size={px(SET_VERTICAL.footerSize, k)} logoHeight={px(SET_VERTICAL.logoHeight, k)} />
    </div>
  );
}

function Landscape({ card, g, shadeStrength }: { card: MatchResultCard; g: ResultGeometry; shadeStrength: number }) {
  const width = g.right - g.left;
  return (
    <div tw="relative flex h-full w-full" style={{ fontFamily: BODY }}>
      <Shade g={g} strength={shadeStrength} />
      <div tw="absolute flex flex-col items-center justify-center" style={{ left: g.left, width, top: g.top, height: g.bottom - g.top - 40 }}>
        <MvpLine card={card} size={15} />
        <div tw="flex" style={{ marginTop: 18 }}>
          <ScoreStrip card={card} k={0.62} scoreSize={150} />
        </div>
        <div tw="flex" style={{ marginTop: 4 }}>
          <ScorerColumns card={card} width={width} size={16} gap={60} />
        </div>
      </div>
      <SetHeader card={card} box={g} k={0.8} />
      <SetFooter card={card} box={g} size={12} logoHeight={26} />
    </div>
  );
}

export function FullFrameTemplate({ card, g, shadeStrength }: { card: MatchResultCard; g: ResultGeometry; shadeStrength: number }) {
  return g.frame.orientation === "landscape" ? <Landscape card={card} g={g} shadeStrength={shadeStrength} /> : <Vertical card={card} g={g} shadeStrength={shadeStrength} />;
}
