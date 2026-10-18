import type { ReactNode } from "react";
import type { SetCard } from "@/types/checkmatch-set";
import type { ScorerLine } from "@/types/match-result";
import { BODY, DISPLAY, TeamLogo, fitFontSize } from "../match-day/shared";
import { blockOpacity, type BlockFilter, type LayoutBlockId } from "./blocks";
import { BallIcon, hexAlpha, type SetBox } from "./set-parts";

/**
 * 16:9 "CheckMatch set" sütunu — Maç Sonucu (01) ve İstatistikler (02) AYNI sütunu aynı yerde
 * çizer (carousel'de kaymaz). Yatay skor şeridi 420px'e sığmadığı için (k≈0,4'te takım adı
 * okunmaz, skora taşar) sütunda dikey dizilir: başlık yuvası · turnuva rozeti · ev sahibi satırı
 * (logo, ad, skor) + golcüleri · ayraç · deplasman satırı + golcüleri. Sütun sağda; tam kadraj
 * fotoğrafta özne sağdaysa sola aynalanır (`side`).
 */

export type ColumnSide = "left" | "right";

export const LANDSCAPE_MARGIN = 64;
export const LANDSCAPE_COLUMN_WIDTH = 420;
/** Sütun ile fotoğraf/panel arası. */
export const LANDSCAPE_GUTTER = 40;
const HEADER_SPACE = 44;
const FOOTER_SPACE = 26 + 22;

/** Sütunun kutusu (kart pikseli): üst/alt sayfa etiketi ve künye için boş bırakılır. */
export function landscapeColumnBox(frame: { width: number; height: number }, side: ColumnSide): SetBox {
  const left = side === "right" ? frame.width - LANDSCAPE_MARGIN - LANDSCAPE_COLUMN_WIDTH : LANDSCAPE_MARGIN;
  return { left, right: left + LANDSCAPE_COLUMN_WIDTH, top: LANDSCAPE_MARGIN + HEADER_SPACE, bottom: frame.height - LANDSCAPE_MARGIN - FOOTER_SPACE };
}

const LOGO = 52;
const NAME = 30;
const SCORE = 76;
const SCORE_COLUMN = 64;
const LOSER_ALPHA = 0.5;

/** Çok golcülü maçta satırlar küçülür ki sütun taşmasın (çakışma kontrolü yine de denetler). */
const scorerSize = (card: SetCard) => (Math.max(card.homeScorers.length, card.awayScorers.length) > 3 ? 13 : 16);

function ScorerList({ lines, size, accent }: { lines: ScorerLine[]; size: number; accent: string }) {
  return (
    <div tw="flex flex-col" style={{ marginLeft: LOGO + 14 }}>
      {lines.map((line) => (
        <div key={`${line.playerId ?? line.name}-${line.minutes[0] ?? ""}`} tw="flex items-center" style={{ marginTop: size * 0.45 }}>
          <BallIcon size={Math.round(size * 0.9)} />
          <span style={{ fontFamily: BODY, fontWeight: 700, fontSize: size, color: "white", marginLeft: size * 0.45, letterSpacing: 0.4 }}>{line.name}</span>
          <span style={{ fontFamily: BODY, fontWeight: 900, fontSize: size, color: accent, marginLeft: size * 0.45 }}>{line.minutes.join(", ")}</span>
        </div>
      ))}
    </div>
  );
}

function TeamRow({ name, logo, goals, dim, width }: { name: string; logo: string | null; goals: number; dim: boolean; width: number }) {
  const nameWidth = width - LOGO - 14 - SCORE_COLUMN - 12;
  return (
    <div tw="flex items-center" style={{ width }}>
      <TeamLogo src={logo} name={name} size={LOGO} />
      <span style={{ fontFamily: DISPLAY, fontSize: fitFontSize(name, nameWidth, NAME, 0.48, 18), lineHeight: 1, letterSpacing: 1, color: "white", marginLeft: 14, width: nameWidth }}>{name}</span>
      <span style={{ fontFamily: DISPLAY, fontSize: SCORE, lineHeight: 1, width: SCORE_COLUMN, textAlign: "right", color: dim ? `rgba(255,255,255,${LOSER_ALPHA})` : "white" }}>{String(goals)}</span>
    </div>
  );
}

export function LandscapeSetColumn({
  card,
  box,
  headline,
  only,
  headlineHeight = 26,
  headlineId = "headline",
}: {
  card: SetCard;
  box: SetBox;
  headline: ReactNode;
  only?: BlockFilter;
  /** Başlık yuvası — C · Manşet'te büyük "MAÇ SONUCU" için yükseltilir. */
  headlineHeight?: number;
  headlineId?: LayoutBlockId;
}) {
  const width = box.right - box.left;
  const size = scorerSize(card);
  return (
    <div tw="absolute flex flex-col justify-center" style={{ left: box.left, top: box.top, width, height: box.bottom - box.top }}>
      <div tw="flex items-center justify-center" style={{ height: headlineHeight, opacity: blockOpacity(only, headlineId) }}>
        {headline}
      </div>
      <div tw="flex flex-col" style={{ marginTop: 18, opacity: blockOpacity(only, "strip") }}>
        <div tw="flex items-center" style={{ marginBottom: 12 }}>
          {card.leagueLogo ? (
            <div tw="flex items-center justify-center" style={{ width: 40, height: 40, borderRadius: 20, border: `2px solid ${card.accentHex}`, boxShadow: `0 0 12px ${hexAlpha(card.accentHex, 0.4)}` }}>
              {/* eslint-disable-next-line @next/next/no-img-element -- Satori yalnızca düz <img> okur. */}
              <img src={card.leagueLogo} alt="" width={26} height={26} style={{ objectFit: "contain" }} />
            </div>
          ) : (
            <div tw="flex" style={{ width: 24, height: 5, backgroundColor: card.accentHex }} />
          )}
          {card.penaltyLabel ? <span style={{ fontFamily: BODY, fontWeight: 700, fontSize: 15, letterSpacing: 2, color: card.accentHex, marginLeft: 14 }}>{card.penaltyLabel}</span> : null}
        </div>
        <TeamRow name={card.homeTeam} logo={card.homeLogo} goals={card.homeGoals} dim={card.outcome === "AWAY"} width={width} />
      </div>
      <div tw="flex" style={{ opacity: blockOpacity(only, "scorers") }}>
        <ScorerList lines={card.homeScorers} size={size} accent={card.accentHex} />
      </div>
      <div tw="flex" style={{ height: 1, width, backgroundColor: "rgba(255,255,255,0.18)", margin: "14px 0", opacity: blockOpacity(only, "strip-away") }} />
      <div tw="flex" style={{ opacity: blockOpacity(only, "strip-away") }}>
        <TeamRow name={card.awayTeam} logo={card.awayLogo} goals={card.awayGoals} dim={card.outcome === "HOME"} width={width} />
      </div>
      <div tw="flex" style={{ opacity: blockOpacity(only, "scorers-away") }}>
        <ScorerList lines={card.awayScorers} size={size} accent={card.accentHex} />
      </div>
    </div>
  );
}
