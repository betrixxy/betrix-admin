import type { TimelineCard, TimelineRowCard } from "@/types/match-analysis";
import { blockOpacity, layerOpacity, stackLayer, STACK_LAYERS, unlayered, type BlockFilter } from "../checkmatch-set/blocks";
import { hexAlpha } from "../checkmatch-set/set-parts";
import { BODY } from "../match-day/shared";
import type { AnalysisGeometry } from "./geometry";
import { EventIcon } from "./icons";
import { axisUnits, axisX, LANE, laneLayout, laneTextSize, type LaneLayout, type LanePlacement } from "./timeline-geometry";

/**
 * 01 · 16:9 yatay zaman çizelgesi: dakika ekseni 0–90+ (devre arası ve uzatma payları eksende ayrı), ev sahibi
 * olayları eksenin üstünde, deplasman altında; her etiket ikonu olayın dakikasının tam üstünde başlar,
 * çakışmasın diye şeritlere dizilir (`laneLayout`). Kırılma anı etiketi vurgu çerçeveli + vurgu zeminli.
 * Şeritler sırayla iki mürekkep katmanında.
 */

const TICKS = [0, 15, 30, 60, 75] as const;
const AXIS = "rgba(255,255,255,0.4)";

function Label({ row, place, card, layout, only }: { row: TimelineRowCard; place: LanePlacement; card: TimelineCard; layout: LaneLayout; only: BlockFilter }) {
  const size = laneTextSize(layout.laneHeight);
  const h = layout.laneHeight - 6;
  const top = row.side === "HOME" ? layout.axis.band.top - (place.lane + 1) * layout.laneHeight + 3 : layout.axis.band.top + layout.axis.band.height + place.lane * layout.laneHeight + 3;
  const accent = card.accentHex;
  const icon = Math.round(size * 1.3);
  const text = [row.text, row.mark].filter(Boolean).join(" ");
  return (
    <div
      tw="absolute flex items-center"
      style={{ left: place.left, top, width: place.width, height: h, paddingLeft: LANE.pad, borderRadius: 5, backgroundColor: row.breakLabel ? hexAlpha(accent, 0.2) : "rgba(16,18,26,0.82)", border: `1.5px solid ${row.breakLabel ? accent : "rgba(255,255,255,0.16)"}`, opacity: layerOpacity(only, stackLayer(place.lane)) }}
    >
      <div tw="flex" style={{ width: icon, height: icon }}><EventIcon kind={row.kind} size={icon} /></div>
      <span style={{ fontFamily: BODY, fontWeight: 800, fontSize: size, lineHeight: 1, color: row.breakLabel ? accent : "rgba(255,255,255,0.75)", marginLeft: Math.round(size * 0.4) }}>{row.minuteLabel}</span>
      <span style={{ fontFamily: BODY, fontWeight: 800, fontSize: size, lineHeight: 1, color: "#fff", marginLeft: Math.round(size * 0.4) }}>{text}</span>
      {row.scoreLabel ? <span style={{ fontFamily: BODY, fontWeight: 900, fontSize: size, lineHeight: 1, color: accent, marginLeft: Math.round(size * 0.4) }}>{row.scoreLabel}</span> : null}
    </div>
  );
}

function AxisLabel({ x, y, text, align, strong }: { x: number; y: number; text: string; align: "center" | "left" | "right"; strong?: boolean }) {
  const size = strong ? 12 : 11;
  const width = Math.ceil(text.length * size * 0.7) + 12;
  const left = align === "center" ? x - width / 2 : align === "left" ? x : x - width;
  return (
    <div tw="absolute flex" style={{ left, top: y, width, height: size + 2, justifyContent: align === "center" ? "center" : align === "left" ? "flex-start" : "flex-end" }}>
      <span style={{ fontFamily: BODY, fontWeight: strong ? 800 : 600, fontSize: size, lineHeight: 1, letterSpacing: size * 0.08, color: strong ? "rgba(255,255,255,0.92)" : "rgba(255,255,255,0.6)" }}>{text}</span>
    </div>
  );
}

export function LandscapeTimelineBody({ card, g, only }: { card: TimelineCard; g: AnalysisGeometry; only: BlockFilter }) {
  const layout = laneLayout(g, card.rows, card.axisEnd);
  const { axis } = layout;
  const at = (minute: number, extra: number | null = null) => axisX(axis, axisUnits(minute, extra, card.axisEnd), card.axisEnd);
  const halfEnd = at(45, 8);
  const secondStart = at(46) - Math.round((at(47) - at(46)) / 2);
  const labelY = axis.y + 9;
  const [halftime, ...rest] = card.dividers;
  const end = rest.at(-1);
  const ticks = card.axisEnd === 120 ? [...TICKS, 105] : TICKS;
  return (
    <div tw="absolute flex" style={{ left: 0, top: 0, width: g.frame.width, height: g.frame.height, opacity: blockOpacity(only, "chart", STACK_LAYERS) }}>
      <div tw="absolute flex" style={{ left: 0, top: 0, width: g.frame.width, height: g.frame.height, opacity: unlayered(only) }}>
        <div tw="absolute flex" style={{ left: axis.left, top: axis.y - 1, width: halfEnd - axis.left, height: 2, backgroundColor: AXIS }} />
        <div tw="absolute flex" style={{ left: secondStart, top: axis.y - 1, width: axis.right - secondStart, height: 2, backgroundColor: AXIS }} />
        {ticks.map((minute) => (
          <div key={`t${minute}`} tw="absolute flex" style={{ left: at(minute) - 1, top: axis.y - 4, width: 2, height: 8, backgroundColor: AXIS }} />
        ))}
        {ticks.map((minute) => (
          <AxisLabel key={`l${minute}`} x={at(minute)} y={labelY} text={`${minute}'`} align={minute === 0 ? "left" : "center"} />
        ))}
        {halftime ? <AxisLabel x={Math.round((halfEnd + secondStart) / 2)} y={labelY} text={halftime.label} align="center" strong /> : null}
        {end ? <AxisLabel x={axis.right} y={labelY} text={end.label} align="right" strong /> : null}
        {layout.placements.map((place) => {
          const row = card.rows[place.row];
          const color = row?.side === "HOME" ? card.homeHex : card.awayHex;
          return <div key={`m${place.row}`} tw="absolute flex" style={{ left: place.x - 4, top: row?.side === "HOME" ? axis.y - 9 : axis.y + 1, width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />;
        })}
      </div>
      {layout.placements.map((place) => {
        const row = card.rows[place.row];
        return row ? <Label key={`e${place.row}`} row={row} place={place} card={card} layout={layout} only={only} /> : null;
      })}
    </div>
  );
}
