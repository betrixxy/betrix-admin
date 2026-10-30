import type { HalvesCard, HalvesRowCard } from "@/types/match-analysis";
import { blockOpacity, layerOpacity, stackLayer, STACK_LAYERS, unlayered, type BlockFilter } from "../checkmatch-set/blocks";
import { BODY, DISPLAY, fitFontSize } from "../match-day/shared";
import { MUTED, TEXT_SHADOW } from "../vitrin/parts";
import { halvesGeometry, type HalvesGeometry } from "./geometry";
import { AnalysisFooter, AnalysisFootnote, AnalysisHeader, AnalysisTitle, TeamsRow } from "./parts";

/**
 * 02 · DEVRE DEVRE: İLK YARI | İKİNCİ YARI yan yana; her satırda ev sahibi değeri · etiket · deplasman değeri,
 * altında takım renklerinde paylaşım çubuğu. Altta 2–3 kural tabanlı olgu (vurgu kareli). Satırlar ve olgular
 * sırayla iki mürekkep katmanında. Kaynak dipnotta ("Devre verisi: API-Football").
 */

const TRACK = "rgba(255,255,255,0.1)";

function HalfColumn({ card, g, column, which, only }: { card: HalvesCard; g: HalvesGeometry; column: { left: number; width: number }; which: "first" | "second"; only: BlockFilter }) {
  const s = g.sizes;
  const scale = (value: number) => (g.landscape ? value : Math.round(value * g.k));
  const header = scale(s.header);
  return (
    <div tw="absolute flex flex-col" style={{ left: column.left, top: g.panel.top, width: column.width, height: g.panel.height }}>
      <div tw="flex flex-col" style={{ height: header + scale(s.headerGap), opacity: unlayered(only) }}>
        <span style={{ fontFamily: BODY, fontWeight: 900, fontSize: header, lineHeight: 1, letterSpacing: header * 0.16, color: card.accentHex }}>{which === "first" ? card.firstLabel : card.secondLabel}</span>
        <div tw="flex" style={{ width: column.width, height: 2, marginTop: Math.round(scale(s.headerGap) * 0.45), backgroundColor: "rgba(255,255,255,0.22)" }} />
      </div>
      {card.rows.map((row, index) => (
        <HalfRow key={row.key} row={row} card={card} g={g} width={column.width} which={which} layer={index} only={only} />
      ))}
    </div>
  );
}

function HalfRow({ row, card, g, width, which, layer, only }: { row: HalvesRowCard; card: HalvesCard; g: HalvesGeometry; width: number; which: "first" | "second"; layer: number; only: BlockFilter }) {
  const s = g.sizes;
  const scale = (value: number) => (g.landscape ? value : Math.round(value * g.k));
  const values = row[which];
  const valueSize = scale(s.value);
  const valueWidth = Math.ceil(4 * valueSize * 0.5);
  const labelSize = fitFontSize(row.label, width - 2 * valueWidth, scale(s.label), 0.72, 9);
  const bar = scale(s.bar);
  const homeWidth = Math.round(width * values.homeShare);
  return (
    <div tw="flex flex-col justify-center" style={{ width, height: g.rowHeight, opacity: layerOpacity(only, stackLayer(layer)) }}>
      <div tw="flex items-center justify-between" style={{ width, height: valueSize }}>
        <span style={{ fontFamily: DISPLAY, fontSize: valueSize, lineHeight: 1, color: "#fff", width: valueWidth, textShadow: TEXT_SHADOW }}>{values.home}</span>
        <span style={{ fontFamily: BODY, fontWeight: 700, fontSize: labelSize, lineHeight: 1, letterSpacing: labelSize * 0.1, color: MUTED }}>{row.label}</span>
        <span style={{ fontFamily: DISPLAY, fontSize: valueSize, lineHeight: 1, color: "#fff", width: valueWidth, textAlign: "right", textShadow: TEXT_SHADOW }}>{values.away}</span>
      </div>
      <div tw="flex" style={{ width, height: bar, marginTop: scale(s.barGap), backgroundColor: TRACK, borderRadius: bar / 2 }}>
        <div tw="flex" style={{ width: homeWidth, height: bar, backgroundColor: card.homeHex, borderRadius: bar / 2 }} />
        <div tw="flex" style={{ width: width - homeWidth - 3, height: bar, marginLeft: 3, backgroundColor: card.awayHex, borderRadius: bar / 2 }} />
      </div>
    </div>
  );
}

function Facts({ card, g, only }: { card: HalvesCard; g: HalvesGeometry; only: BlockFilter }) {
  if (card.facts.length === 0) return null;
  const s = g.sizes;
  const size = g.factSize;
  const bullet = Math.round(size * 0.42);
  const gap = g.landscape ? s.factGap : Math.round(s.factGap * g.k);
  const width = g.box.right - g.box.left;
  return (
    <div tw="absolute flex flex-col" style={{ left: g.box.left, top: g.facts.top, width, height: g.facts.height, opacity: blockOpacity(only, "fact", STACK_LAYERS) }}>
      {card.facts.map((fact, index) => (
        <div key={fact} tw="flex items-start" style={{ width, marginTop: index === 0 ? 0 : gap, height: Math.ceil((g.factLines[index] ?? 1) * size * s.factLine), opacity: layerOpacity(only, stackLayer(index)) }}>
          <div tw="flex" style={{ width: bullet, height: bullet, marginTop: Math.round(size * 0.42), marginRight: Math.round(size * 0.68), backgroundColor: card.accentHex }} />
          <span style={{ fontFamily: BODY, fontWeight: 600, fontSize: size, lineHeight: s.factLine, color: "rgba(255,255,255,0.92)", width: width - bullet - Math.round(size * 0.68) }}>{fact}</span>
        </div>
      ))}
    </div>
  );
}

export function HalvesTemplate({ card, frame, only }: { card: HalvesCard; frame: HalvesGeometry["frame"]; only?: BlockFilter }) {
  const g = halvesGeometry(frame, card.rows.length, card.facts);
  return (
    <div tw="relative flex h-full w-full" style={{ fontFamily: BODY }}>
      <AnalysisHeader card={card} g={g} only={only} />
      <AnalysisTitle card={card} g={g} only={only} />
      <TeamsRow card={card} g={g} only={only} />
      <div tw="absolute flex" style={{ left: 0, top: 0, width: frame.width, height: frame.height, opacity: blockOpacity(only, "panel", STACK_LAYERS) }}>
        <HalfColumn card={card} g={g} column={g.columns[0]} which="first" only={only} />
        <HalfColumn card={card} g={g} column={g.columns[1]} which="second" only={only} />
      </div>
      <Facts card={card} g={g} only={only} />
      <AnalysisFootnote card={card} g={g} only={only} />
      <AnalysisFooter card={card} g={g} only={only} />
    </div>
  );
}
