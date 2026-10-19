import { DRAW_HEX } from "@/lib/dashboard/vitrin-card";
import type { VitrinCard } from "@/types/vitrin";
import { blockOpacity, type BlockFilter } from "../checkmatch-set/blocks";
import { SetFooter, SetHeader } from "../checkmatch-set/set-parts";
import { BODY, DISPLAY, fitFontSize, px } from "../match-day/shared";
import type { PosterGeometry } from "./geometry";
import { MUTED, Percent, SHADE_RGB, TEXT_SHADOW, percentWidth } from "./parts";
import { VITRIN_SIZES } from "./geometry";

/**
 * 01 POSTER — "yayıncı grafiği": iki takımın arşiv fotoğrafı çapraz bölünmüş tam kadraj (sanat
 * katmanı, `vitrin-photo.ts`), ortada ince çapraz çizgi; büyük takım adları; tam genişlik kazanma
 * çubuğu (ev rengi │ beraberlik grisi │ deplasman rengi, olasılıkla orantılı) + üç büyük yüzde;
 * tek satır manşet. Gerekçe bu sayfada YOK.
 */

/** Çok küçük segment de görünsün diye asgari pay (çubuk genişliğinin oranı). */
const MIN_SEGMENT = 0.06;

function PosterShade({ g, only }: { g: PosterGeometry; only: BlockFilter }) {
  if (only) return null;
  const { width, height } = g.frame;
  const span = g.shade.direction === "down" ? height : width;
  const start = (g.shade.start / span) * 100;
  const solid = (g.shade.solid / span) * 100;
  // Fotoğraf bölgesinin bittiği yerde zemin tam koyu: fotoğrafın alt kenarı çizgi olarak görünmez.
  const photoEnd = (Math.max(g.shade.solid, g.shade.direction === "down" ? g.photo.region.bottom : g.photo.region.right) / span) * 100;
  const direction = g.shade.direction === "down" ? "to bottom" : "to right";
  const { region, topX, bottomX } = g.photo;
  const line = Math.max(2, px(3, g.k));
  return (
    <div tw="absolute flex" style={{ left: 0, top: 0, width, height }}>
      <div tw="absolute flex" style={{ left: 0, top: 0, width, height, backgroundImage: `linear-gradient(${direction}, rgba(${SHADE_RGB},0) ${start}%, rgba(${SHADE_RGB},0.78) ${(start + solid) / 2}%, rgba(${SHADE_RGB},0.96) ${solid}%, rgba(${SHADE_RGB},1) ${photoEnd}%, rgba(${SHADE_RGB},1) 100%)` }} />
      <div tw="absolute flex" style={{ left: 0, top: 0, width, height: px(220, g.k), backgroundImage: `linear-gradient(to bottom, rgba(${SHADE_RGB},0.6), rgba(${SHADE_RGB},0))` }} />
      {/* Ortadaki ince çapraz çizgi — gradyanla birlikte aşağıda söner. */}
      <svg style={{ position: "absolute", left: 0, top: 0 }} width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <defs>
          <linearGradient id="split" gradientUnits="userSpaceOnUse" x1={topX} y1={region.top} x2={bottomX} y2={region.bottom}>
            <stop offset="0" stopColor="#ffffff" stopOpacity="0.9" />
            <stop offset="0.7" stopColor="#ffffff" stopOpacity="0.55" />
            <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>
        </defs>
        <line x1={topX} y1={region.top} x2={bottomX} y2={region.bottom} stroke="url(#split)" strokeWidth={line} />
      </svg>
    </div>
  );
}

function Teams({ card, g, only }: { card: VitrinCard; g: PosterGeometry; only: BlockFilter }) {
  const width = g.column.right - g.column.left;
  const size = fitFontSize(`${card.homeTeam} × ${card.awayTeam}`, width, g.teams.height, 0.47, px(40, g.k));
  const name = { fontFamily: DISPLAY, fontSize: size, lineHeight: 1, color: "#fff", letterSpacing: size * 0.01, textShadow: TEXT_SHADOW };
  return (
    <div tw="absolute flex items-center justify-center" style={{ left: g.column.left, top: g.teams.top, width, height: g.teams.height, opacity: blockOpacity(only, "teams") }}>
      <span style={name}>{card.homeTeam}</span>
      <span style={{ fontFamily: BODY, fontWeight: 300, fontSize: Math.round(size * 0.6), lineHeight: 1, color: card.accentHex, margin: `0 ${Math.round(size * 0.22)}px` }}>×</span>
      <span style={name}>{card.awayTeam}</span>
    </div>
  );
}

/** Segment genişlikleri: olasılıkla orantılı, asgari pay korunarak. */
function segmentWidths(values: [number, number, number], total: number): [number, number, number] {
  const shares = values.map((value) => Math.max(MIN_SEGMENT, value / 100));
  const sum = shares.reduce((a, b) => a + b, 0);
  const widths = shares.map((share) => Math.round((share / sum) * total));
  widths[1] = total - (widths[0] ?? 0) - (widths[2] ?? 0);
  return widths as [number, number, number];
}

function WinBar({ card, g, only }: { card: VitrinCard; g: PosterGeometry; only: BlockFilter }) {
  const { k } = g;
  const s = VITRIN_SIZES;
  const width = g.column.right - g.column.left;
  const gap = px(6, k);
  const barHeight = px(s.bar, k);
  const radius = px(12, k);
  const { home, draw, away } = card.winBar;
  const [wHome, wDraw, wAway] = segmentWidths([home, draw, away], width - 2 * gap);
  const size = px(s.barPercent, k);
  const percentTop = barHeight + px(16, k);
  const labelTop = percentTop + size + px(6, k);
  // Beraberlik yüzdesi kendi segmentinin ortasında; iki uçtaki yüzdelere çarpmayacak şekilde sıkıştırılır.
  const drawWidth = percentWidth(draw, size);
  const minCenter = percentWidth(home, size) + px(28, k) + drawWidth / 2;
  const maxCenter = width - percentWidth(away, size) - px(28, k) - drawWidth / 2;
  const drawCenter = Math.min(maxCenter, Math.max(minCenter, wHome + gap + wDraw / 2));
  const labelSize = px(s.barLabel, k);
  const label = { fontFamily: BODY, fontWeight: 700, fontSize: labelSize, lineHeight: 1, letterSpacing: labelSize * 0.12, color: MUTED };
  const segment = (w: number, color: string, ends: "left" | "mid" | "right") => (
    <div tw="flex" style={{ width: w, height: barHeight, backgroundColor: color, borderRadius: ends === "left" ? `${radius}px 0 0 ${radius}px` : ends === "right" ? `0 ${radius}px ${radius}px 0` : 0 }} />
  );
  return (
    <div tw="absolute flex" style={{ left: g.column.left, top: g.bar.top, width, height: g.bar.height, opacity: blockOpacity(only, "win-bar") }}>
      <div tw="absolute flex" style={{ left: 0, top: 0, width, height: barHeight }}>
        {segment(wHome, card.homeHex, "left")}
        <div tw="flex" style={{ width: gap }} />
        {segment(wDraw, DRAW_HEX, "mid")}
        <div tw="flex" style={{ width: gap }} />
        {segment(wAway, card.awayHex, "right")}
      </div>
      <div tw="absolute flex flex-col items-start" style={{ left: 0, top: percentTop }}>
        <Percent value={home} size={size} color={card.homeHex} />
      </div>
      <div tw="absolute flex flex-col items-center" style={{ left: Math.round(drawCenter - drawWidth / 2), top: percentTop, width: drawWidth }}>
        <Percent value={draw} size={size} color="rgba(255,255,255,0.78)" />
      </div>
      <div tw="absolute flex flex-col items-end" style={{ right: 0, top: percentTop }}>
        <Percent value={away} size={size} color={card.awayHex} />
      </div>
      <span tw="absolute" style={{ ...label, left: 0, top: labelTop }}>{card.homeTeam}</span>
      <div tw="absolute flex justify-center" style={{ left: Math.round(drawCenter - px(120, k)), top: labelTop, width: px(240, k) }}>
        <span style={label}>BERABERLİK</span>
      </div>
      <span tw="absolute" style={{ ...label, right: 0, top: labelTop }}>{card.awayTeam}</span>
    </div>
  );
}

/** Tek satır manşet; favori varsa takım adı kendi renginde. */
function Headline({ card, g, only }: { card: VitrinCard; g: PosterGeometry; only: BlockFilter }) {
  const width = g.column.right - g.column.left;
  const { headline, favourite } = card.winBar;
  const size = fitFontSize(headline, width, px(38, g.k), 0.52, px(20, g.k));
  const text = { fontFamily: BODY, fontWeight: 600, fontSize: size, lineHeight: 1, color: "#fff", textShadow: TEXT_SHADOW };
  const parts = favourite ? /^(Modelimiz )(.+)( diyor)$/u.exec(headline) : null;
  return (
    <div tw="absolute flex items-center justify-center" style={{ left: g.column.left, top: g.headline.top, width, height: g.headline.height, opacity: blockOpacity(only, "headline") }}>
      {parts ? (
        <>
          <span style={text}>{(parts[1] ?? "").trim()}</span>
          <span style={{ ...text, fontWeight: 800, color: favourite === "HOME" ? card.homeHex : card.awayHex, margin: `0 ${Math.round(size * 0.28)}px` }}>{parts[2]}</span>
          <span style={text}>{(parts[3] ?? "").trim()}</span>
        </>
      ) : (
        <span style={text}>{headline}</span>
      )}
    </div>
  );
}

export function PosterTemplate({ card, g, only }: { card: VitrinCard; g: PosterGeometry; only?: BlockFilter }) {
  const s = VITRIN_SIZES;
  return (
    <div tw="relative flex h-full w-full" style={{ fontFamily: BODY }}>
      <PosterShade g={g} only={only} />
      <SetHeader card={{ pageLabel: card.pageLabels[0], dateLabel: card.dateLabel, accentHex: card.accentHex }} box={g.box} k={g.k} only={only} />
      <Teams card={card} g={g} only={only} />
      <WinBar card={card} g={g} only={only} />
      <Headline card={card} g={g} only={only} />
      <SetFooter card={card} box={g.box} size={px(s.footerSize, g.k)} logoHeight={px(s.logoHeight, g.k)} only={only} />
    </div>
  );
}
