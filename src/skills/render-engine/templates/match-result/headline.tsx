import type { MatchResultCard } from "@/types/match-result";
import { blockOpacity, type BlockFilter } from "../checkmatch-set/blocks";
import { LandscapeSetColumn } from "../checkmatch-set/landscape";
import { ScorerColumns, SET_VERTICAL, SetFooter, SetHeader, setBlockBottom } from "../checkmatch-set/set-parts";
import { BODY, DISPLAY, DISPLAY_DESCENT_EM, TeamLogo, fitFontSize, px } from "../match-day/shared";
import { HEADLINE_VERTICAL, type ResultGeometry } from "./geometry";
import { Shade, TopShade, type ResultTemplateProps } from "./shared";

/**
 * C · MANŞET — üstte dev "MAÇ SONUCU" (vurgu renginde çizgiyle), fotoğraf ortada, altta minimal
 * skor: tek satır "logo AD  0 – 1  AD logo" + küçük golcü listesi. Set kuralları geçerli: sayfa
 * etiketi + tarih başlığın üstünde, künye + CheckMatch logosu sağ altta, tek vurgu rengi.
 * Fotoğrafın yazısız bölgesi başlık bandının altından başlar (`ResultGeometry.titleBand`).
 * 16:9'da başlık set sütununun tepesindedir.
 */

const TITLE = "MAÇ SONUCU";
const MINI = { logo: 52, name: 34, score: 72, gap: 16, scorer: 20, scorerGap: 6 } as const;
const LOSER_ALPHA = 0.5;

function Title({ card, size, rule }: { card: MatchResultCard; size: number; rule: number }) {
  return (
    <div tw="flex flex-col items-center">
      <span style={{ fontFamily: DISPLAY, fontSize: size, lineHeight: 1, letterSpacing: size * 0.02, color: "white" }}>{TITLE}</span>
      {/* Çizgi "MAÇ"ın Ç kuyruğunun (≈ 0,25 em) altında. */}
      <div tw="flex" style={{ width: size * 0.7, height: rule, backgroundColor: card.accentHex, marginTop: Math.ceil(size * (DISPLAY_DESCENT_EM + 0.08)) }} />
    </div>
  );
}

function MiniScore({ card, k, width }: { card: MatchResultCard; k: number; width: number }) {
  const scoreWidth = px(MINI.score * 2.2, k);
  const side = (width - scoreWidth) / 2;
  const nameSize = (name: string) => fitFontSize(name, side - px(MINI.logo + MINI.gap, k), px(MINI.name, k), 0.48, px(18, k));
  const digit = (value: number, dim: boolean) => (
    <span style={{ fontFamily: DISPLAY, fontSize: px(MINI.score, k), lineHeight: 1, color: dim ? `rgba(255,255,255,${LOSER_ALPHA})` : "white" }}>{String(value)}</span>
  );
  return (
    <div tw="flex items-center" style={{ width }}>
      <div tw="flex items-center justify-end" style={{ width: side }}>
        <TeamLogo src={card.homeLogo} name={card.homeTeam} size={px(MINI.logo, k)} />
        <span style={{ fontFamily: DISPLAY, fontSize: nameSize(card.homeTeam), lineHeight: 1, color: "white", marginLeft: px(MINI.gap, k) }}>{card.homeTeam}</span>
      </div>
      <div tw="flex items-center justify-center" style={{ width: scoreWidth }}>
        {digit(card.homeGoals, card.outcome === "AWAY")}
        <div tw="flex" style={{ width: px(22, k), height: px(5, k), backgroundColor: card.accentHex, margin: `0 ${px(18, k)}px` }} />
        {digit(card.awayGoals, card.outcome === "HOME")}
      </div>
      <div tw="flex items-center justify-start" style={{ width: side }}>
        <span style={{ fontFamily: DISPLAY, fontSize: nameSize(card.awayTeam), lineHeight: 1, color: "white", marginRight: px(MINI.gap, k) }}>{card.awayTeam}</span>
        <TeamLogo src={card.awayLogo} name={card.awayTeam} size={px(MINI.logo, k)} />
      </div>
    </div>
  );
}

function Vertical({ card, g, only }: { card: MatchResultCard; g: ResultGeometry; only: BlockFilter }) {
  const { k, frame } = g;
  const width = g.right - g.left;
  const h = HEADLINE_VERTICAL;
  return (
    <>
      <div tw="absolute flex justify-center" style={{ left: g.left, width, top: g.top + px(h.titleGap, k), opacity: blockOpacity(only, "title") }}>
        <Title card={card} size={px(h.title, k)} rule={px(h.rule, k)} />
      </div>
      <div tw="absolute flex flex-col items-center" style={{ left: g.left, width, bottom: frame.height - setBlockBottom(g, k) }}>
        <div tw="flex" style={{ opacity: blockOpacity(only, "strip") }}>
          <MiniScore card={card} k={k} width={width} />
        </div>
        <div tw="flex" style={{ marginTop: px(MINI.scorerGap, k), opacity: blockOpacity(only, "scorers") }}>
          <ScorerColumns card={card} width={width} size={px(MINI.scorer, k)} gap={px(MINI.score * 2.2, k)} />
        </div>
      </div>
    </>
  );
}

export function HeadlineTemplate({ card, g, shadeStrength, only }: ResultTemplateProps) {
  const landscape = g.column !== null;
  return (
    <div tw="relative flex h-full w-full" style={{ fontFamily: BODY }}>
      <Shade g={g} strength={shadeStrength} only={only} />
      <TopShade g={g} strength={Math.max(shadeStrength, 0.5)} only={only} />
      <SetHeader card={card} box={g} k={landscape ? 0.8 : g.k} only={only} />
      {g.column ? (
        <LandscapeSetColumn card={card} box={g.column} headline={<Title card={card} size={58} rule={4} />} headlineHeight={78} headlineId="title" only={only} />
      ) : (
        <Vertical card={card} g={g} only={only} />
      )}
      {landscape ? (
        <SetFooter card={card} box={g} size={17} logoHeight={26} only={only} />
      ) : (
        <SetFooter card={card} box={g} size={px(SET_VERTICAL.footerSize, g.k)} logoHeight={px(SET_VERTICAL.logoHeight, g.k)} only={only} />
      )}
    </div>
  );
}
