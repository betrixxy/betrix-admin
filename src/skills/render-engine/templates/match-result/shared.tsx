import type { MatchResultCard, ScorerLine } from "@/types/match-result";
import { BRAND_LOGO_ALT, brandLogoWidth } from "../brand";
import { BODY, DISPLAY, TeamLogo, fitFontSize, px } from "../match-day/shared";
import type { ResultGeometry } from "./geometry";

/**
 * Maç Sonucu şablonlarının ortak yapı taşları (Satori). Kurallar: skor kartın en büyük metni,
 * tek vurgu rengi (`card.accentHex`), tüm yazılar koyu gradyanın üstünde, marka sağ altta.
 * Başlık/skor: Anton (condensed, Türkçe karakterli) · künye: Geist.
 */

const SHADE_RGB = "7,8,12";
const LOSER_ALPHA = 0.5;

/** Kartın alt (yatayda sağ) bölgesini koyulaştıran gradyan — z-data-layer'ın okunabilirlik paneli. */
export function Shade({ g }: { g: ResultGeometry }) {
  const { width, height, orientation } = g.frame;
  const vertical = orientation === "vertical";
  const span = vertical ? height : width;
  const start = (g.shadeStart / span) * 100;
  const solid = (g.shadeSolid / span) * 100;
  return (
    <div
      tw="absolute flex"
      style={{
        left: 0,
        top: 0,
        width,
        height,
        backgroundImage: `linear-gradient(${vertical ? "to bottom" : "to right"}, rgba(${SHADE_RGB},0) ${start}%, rgba(${SHADE_RGB},0.78) ${(start + solid) / 2}%, rgba(${SHADE_RGB},0.94) ${solid}%, rgba(${SHADE_RGB},0.97) 100%)`,
      }}
    />
  );
}

/** Top ikonu — gol satırı başında. Beyaz kontur + merkez beşgen; vurgu rengi kullanmaz. */
export function BallIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10.6" fill="white" />
      <path d="M12 7.2l4.1 3-1.6 4.8H9.5L7.9 10.2z" fill="#111" />
      <path d="M12 1.4v5.8M16.1 10.2l5.3-1.8M14.5 15l3.3 4.6M9.5 15l-3.3 4.6M7.9 10.2L2.6 8.4" stroke="#111" strokeWidth="1.3" fill="none" />
    </svg>
  );
}

function ScoreDigit({ value, size, dim }: { value: number; size: number; dim: boolean }) {
  return (
    <span style={{ fontFamily: DISPLAY, fontSize: size, lineHeight: 1, color: dim ? `rgba(255,255,255,${LOSER_ALPHA})` : "white" }}>
      {String(value)}
    </span>
  );
}

function TeamColumn({ name, logo, width, logoSize, nameSize }: { name: string; logo: string | null; width: number; logoSize: number; nameSize: number }) {
  return (
    <div tw="flex flex-col items-center" style={{ width }}>
      <TeamLogo src={logo} name={name} size={logoSize} />
      <span
        style={{
          fontFamily: DISPLAY,
          fontSize: fitFontSize(name, width, nameSize, 0.5, 18),
          lineHeight: 1,
          letterSpacing: 1,
          color: "white",
          marginTop: Math.round(logoSize * 0.18),
        }}
      >
        {name}
      </span>
    </div>
  );
}

/** Skor şeridi: logo+ad · skor · turnuva logosu · skor · logo+ad. Kaybedenin skoru soluk. */
export function ScoreStrip({ card, k, scoreSize }: { card: MatchResultCard; k: number; scoreSize: number }) {
  const dimHome = card.outcome === "AWAY";
  const dimAway = card.outcome === "HOME";
  const column = px(250, k);
  const center = px(124, k);
  return (
    <div tw="flex items-center justify-center">
      <TeamColumn name={card.homeTeam} logo={card.homeLogo} width={column} logoSize={px(92, k)} nameSize={px(36, k)} />
      <div tw="flex justify-center" style={{ width: px(132, k) }}>
        <ScoreDigit value={card.homeGoals} size={scoreSize} dim={dimHome} />
      </div>
      <div tw="flex flex-col items-center justify-center" style={{ width: center }}>
        {card.leagueLogo ? (
          <div tw="flex items-center justify-center" style={{ width: px(92, k), height: px(92, k), borderRadius: px(18, k), backgroundColor: "rgba(255,255,255,0.95)" }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- Satori yalnızca düz <img> okur. */}
            <img src={card.leagueLogo} alt="" width={px(70, k)} height={px(70, k)} style={{ objectFit: "contain" }} />
          </div>
        ) : (
          <div tw="flex" style={{ width: px(28, k), height: px(6, k), backgroundColor: card.accentHex }} />
        )}
        {card.penaltyLabel ? (
          <span style={{ fontFamily: BODY, fontWeight: 700, fontSize: px(18, k), letterSpacing: 2, color: card.accentHex, marginTop: px(12, k) }}>
            {card.penaltyLabel}
          </span>
        ) : null}
      </div>
      <div tw="flex justify-center" style={{ width: px(132, k) }}>
        <ScoreDigit value={card.awayGoals} size={scoreSize} dim={dimAway} />
      </div>
      <TeamColumn name={card.awayTeam} logo={card.awayLogo} width={column} logoSize={px(92, k)} nameSize={px(36, k)} />
    </div>
  );
}

/** Ev sahibi satırı aynalanır (isim · dakika · top): ikonlar iki sütunda da dış kenarda hizalı kalır. */
function ScorerRow({ line, size, accent, align }: { line: ScorerLine; size: number; accent: string; align: "left" | "right" }) {
  const gap = size * 0.45;
  const icon = <BallIcon size={Math.round(size * 0.92)} />;
  return (
    <div tw="flex items-center" style={{ marginTop: size * 0.5 }}>
      {align === "left" ? icon : null}
      <span style={{ fontFamily: BODY, fontWeight: 700, fontSize: size, color: "white", marginLeft: align === "left" ? gap : 0, letterSpacing: 0.5 }}>
        {line.name}
      </span>
      <span style={{ fontFamily: BODY, fontWeight: 900, fontSize: size, color: accent, margin: `0 ${align === "right" ? gap : 0}px 0 ${gap}px` }}>
        {line.minutes.join(", ")}
      </span>
      {align === "right" ? icon : null}
    </div>
  );
}

/** İki sütun golcü listesi — ev sahibi sağa (merkeze), deplasman sola (merkeze) yaslı. */
export function ScorerColumns({ card, width, size, gap }: { card: MatchResultCard; width: number; size: number; gap: number }) {
  const columnWidth = (width - gap) / 2;
  const column = (lines: ScorerLine[], align: "left" | "right") => (
    <div tw="flex flex-col" style={{ width: columnWidth, alignItems: align === "right" ? "flex-end" : "flex-start" }}>
      {lines.map((line) => (
        <ScorerRow key={`${line.playerId ?? line.name}-${line.minutes[0] ?? ""}`} line={line} size={size} accent={card.accentHex} align={align} />
      ))}
    </div>
  );
  return (
    <div tw="flex" style={{ width }}>
      {column(card.homeScorers, "right")}
      <div tw="flex" style={{ width: gap }} />
      {column(card.awayScorers, "left")}
    </div>
  );
}

/** Künye (sol) + CheckMatch logosu (sağ alt köşe, tüm şablonlarda aynı yer). */
export function Footer({ card, g, size, logoHeight }: { card: MatchResultCard; g: ResultGeometry; size: number; logoHeight: number }) {
  const line = [card.competitionLabel, card.roundLabel].filter(Boolean).join("  ·  ");
  return (
    <div
      tw="absolute flex items-center justify-between"
      style={{ left: g.left, width: g.right - g.left, top: g.bottom - logoHeight, height: logoHeight }}
    >
      <span style={{ fontFamily: BODY, fontWeight: 700, fontSize: size, letterSpacing: size * 0.18, color: "rgba(255,255,255,0.78)" }}>{line}</span>
      {/* eslint-disable-next-line @next/next/no-img-element -- Satori yalnızca düz <img> okur. */}
      <img src={card.brandLogo} alt={BRAND_LOGO_ALT} width={brandLogoWidth(logoHeight)} height={logoHeight} />
    </div>
  );
}
