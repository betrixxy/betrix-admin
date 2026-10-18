import type { MatchResultCard } from "@/types/match-result";
import { blockOpacity, type BlockFilter } from "../checkmatch-set/blocks";
import { LANDSCAPE_COLUMN_WIDTH } from "../checkmatch-set/landscape";
import { ScorerColumns, SET_VERTICAL, SetFooter, SetHeader, hexAlpha, setBlockBottom } from "../checkmatch-set/set-parts";
import { BODY, DISPLAY, TeamLogo, fitFontSize, px } from "../match-day/shared";
import type { ResultGeometry } from "./geometry";
import { MvpLine, Shade, type ResultTemplateProps } from "./shared";

/**
 * B · DEV SKOR — skor kartın ortasında dev boyutta, fotoğraftaki oyuncuların önünde (gradyanın
 * üst kenarından taşar); takımlar skorun üstünde logo + adla, golcüler skorun altında iki yan
 * listede (ev sahibi solda, deplasman sağda). Set kuralları geçerli: üstte sayfa etiketi + tarih,
 * altta künye + CheckMatch logosu, tek vurgu rengi. 16:9'da set sütununda dikey dizilir.
 */

const BIG = { score: 300, team: 34, logo: 64, teamGap: 14, scoreGap: 4, scorer: 22, scorerGap: 10, headlineGap: 18 } as const;
const LOSER_ALPHA = 0.5;

function Digit({ value, size, dim }: { value: number; size: number; dim: boolean }) {
  return <span style={{ fontFamily: DISPLAY, fontSize: size, lineHeight: 1, color: dim ? `rgba(255,255,255,${LOSER_ALPHA})` : "white" }}>{String(value)}</span>;
}

function Badge({ card, size }: { card: MatchResultCard; size: number }) {
  if (!card.leagueLogo) return <div tw="flex" style={{ width: size * 0.4, height: size * 0.08, backgroundColor: card.accentHex }} />;
  return (
    <div tw="flex items-center justify-center" style={{ width: size, height: size, borderRadius: size / 2, border: `2px solid ${card.accentHex}`, boxShadow: `0 0 ${size * 0.25}px ${hexAlpha(card.accentHex, 0.45)}` }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- Satori yalnızca düz <img> okur. */}
      <img src={card.leagueLogo} alt="" width={Math.round(size * 0.62)} height={Math.round(size * 0.62)} style={{ objectFit: "contain" }} />
    </div>
  );
}

function Team({ name, logo, width, k, align }: { name: string; logo: string | null; width: number; k: number; align: "left" | "right" }) {
  const size = fitFontSize(name, width - px(BIG.logo + BIG.teamGap, k), px(BIG.team, k), 0.48, px(20, k));
  const label = <span style={{ fontFamily: DISPLAY, fontSize: size, lineHeight: 1, letterSpacing: 1, color: "white", margin: `0 ${px(BIG.teamGap, k)}px` }}>{name}</span>;
  const badge = <TeamLogo src={logo} name={name} size={px(BIG.logo, k)} />;
  return (
    <div tw="flex items-center" style={{ width, justifyContent: align === "left" ? "flex-start" : "flex-end" }}>
      {align === "left" ? badge : label}
      {align === "left" ? label : badge}
    </div>
  );
}

function Vertical({ card, g, only }: { card: MatchResultCard; g: ResultGeometry; only: BlockFilter }) {
  const { k, frame } = g;
  const width = g.right - g.left;
  const half = width / 2;
  const score = px(BIG.score, k);
  return (
    <div tw="absolute flex flex-col items-center" style={{ left: g.left, width, bottom: frame.height - setBlockBottom(g, k) }}>
      <div tw="flex items-center justify-center" style={{ height: px(SET_VERTICAL.headlineSlot, k), opacity: blockOpacity(only, "headline") }}>
        <MvpLine card={card} size={px(20, k)} />
      </div>
      <div tw="flex flex-col items-center" style={{ marginTop: px(BIG.headlineGap, k), opacity: blockOpacity(only, "strip") }}>
        <div tw="flex">
          <Team name={card.homeTeam} logo={card.homeLogo} width={half} k={k} align="left" />
          <Team name={card.awayTeam} logo={card.awayLogo} width={half} k={k} align="right" />
        </div>
        <div tw="flex items-center justify-center" style={{ marginTop: px(BIG.scoreGap, k) }}>
          <Digit value={card.homeGoals} size={score} dim={card.outcome === "AWAY"} />
          <div tw="flex flex-col items-center justify-center" style={{ width: px(150, k) }}>
            <Badge card={card} size={px(84, k)} />
            {card.penaltyLabel ? <span style={{ fontFamily: BODY, fontWeight: 700, fontSize: px(18, k), letterSpacing: 2, color: card.accentHex, marginTop: px(10, k) }}>{card.penaltyLabel}</span> : null}
          </div>
          <Digit value={card.awayGoals} size={score} dim={card.outcome === "HOME"} />
        </div>
      </div>
      <div tw="flex" style={{ marginTop: px(BIG.scorerGap, k), opacity: blockOpacity(only, "scorers") }}>
        <ScorerColumns card={card} width={width} size={px(BIG.scorer, k)} gap={px(150, k)} />
      </div>
    </div>
  );
}

/** 16:9 — set sütununda: başlık · logolar · dev "0  1" · golcüler (iki liste alt alta). */
function Landscape({ card, g, only }: { card: MatchResultCard; g: ResultGeometry; only: BlockFilter }) {
  const column = g.column ?? { left: g.left, right: g.right, top: g.top, bottom: g.bottom };
  const width = Math.min(LANDSCAPE_COLUMN_WIDTH, column.right - column.left);
  const half = width / 2;
  return (
    <div tw="absolute flex flex-col items-center justify-center" style={{ left: column.left, top: column.top, width, height: column.bottom - column.top }}>
      <div tw="flex" style={{ height: 26, opacity: blockOpacity(only, "headline") }}>
        <MvpLine card={card} size={14} />
      </div>
      <div tw="flex flex-col items-center" style={{ marginTop: 12, opacity: blockOpacity(only, "strip") }}>
        <div tw="flex">
          <Team name={card.homeTeam} logo={card.homeLogo} width={half} k={0.62} align="left" />
          <Team name={card.awayTeam} logo={card.awayLogo} width={half} k={0.62} align="right" />
        </div>
        <div tw="flex items-center justify-center">
          <Digit value={card.homeGoals} size={170} dim={card.outcome === "AWAY"} />
          <div tw="flex items-center justify-center" style={{ width: 90 }}>
            <Badge card={card} size={50} />
          </div>
          <Digit value={card.awayGoals} size={170} dim={card.outcome === "HOME"} />
        </div>
      </div>
      <div tw="flex" style={{ opacity: blockOpacity(only, "scorers") }}>
        <ScorerColumns card={card} width={width} size={14} gap={24} />
      </div>
    </div>
  );
}

export function BigScoreTemplate({ card, g, shadeStrength, only }: ResultTemplateProps) {
  const landscape = g.column !== null;
  return (
    <div tw="relative flex h-full w-full" style={{ fontFamily: BODY }}>
      <Shade g={g} strength={Math.max(shadeStrength, 0.45)} only={only} />
      <SetHeader card={card} box={g} k={landscape ? 0.8 : g.k} only={only} />
      {landscape ? <Landscape card={card} g={g} only={only} /> : <Vertical card={card} g={g} only={only} />}
      {landscape ? (
        <SetFooter card={card} box={g} size={17} logoHeight={26} only={only} />
      ) : (
        <SetFooter card={card} box={g} size={px(SET_VERTICAL.footerSize, g.k)} logoHeight={px(SET_VERTICAL.logoHeight, g.k)} only={only} />
      )}
    </div>
  );
}
