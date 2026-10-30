import type { TimelineCard, TimelineRowCard } from "@/types/match-analysis";
import { blockOpacity, layerOpacity, stackLayer, STACK_LAYERS, unlayered, type BlockFilter } from "../checkmatch-set/blocks";
import { hexAlpha } from "../checkmatch-set/set-parts";
import { BODY, fitFontSize, px } from "../match-day/shared";
import { MUTED, TEXT_SHADOW } from "../vitrin/parts";
import type { AnalysisGeometry } from "./geometry";
import { EventIcon } from "./icons";
import { verticalTimeline, type TimelineSlotKind, type VerticalTimeline } from "./timeline-geometry";

/**
 * 01 dikey zaman çizelgesi: ortada dakika omurgası (dakika rozeti), ev sahibi solda (ikon omurgaya yakın),
 * deplasman sağda. Kırılma anı satırı vurgu renginde: soluk zemin + dış kenarda vurgu çizgisi + etiket
 * ("İLK GOL"), dakika rozeti vurgu renginde. Golde akan skor ("0-1"). Ayraçlar (İLK YARI 0-2, MAÇ SONU 0-4)
 * tam genişlik çizgi + ortada etiket. Satırlar sırayla iki mürekkep katmanında (`stack-a`/`stack-b`).
 */

const GEIST_EM = 0.64;
const SPINE = "rgba(255,255,255,0.2)";

function slotKinds(card: TimelineCard): TimelineSlotKind[] {
  const kinds: TimelineSlotKind[] = [];
  card.rows.forEach((_, index) => {
    for (const divider of card.dividers) if (divider.beforeRow === index) kinds.push("divider");
    kinds.push("row");
  });
  for (const divider of card.dividers) if (divider.beforeRow >= card.rows.length) kinds.push("divider");
  return kinds;
}

function BreakTag({ label, accent, size }: { label: string; accent: string; size: number }) {
  return (
    <div tw="flex items-center" style={{ height: Math.round(size * 1.7), paddingLeft: Math.round(size * 0.6), paddingRight: Math.round(size * 0.6), borderRadius: 4, backgroundColor: accent }}>
      <span style={{ fontFamily: BODY, fontWeight: 900, fontSize: size, lineHeight: 1, letterSpacing: size * 0.08, color: "#0B0C10" }}>{label}</span>
    </div>
  );
}

function Row({ row, card, g, t, top, index, only }: { row: TimelineRowCard; card: TimelineCard; g: AnalysisGeometry; t: VerticalTimeline; top: number; index: number; only: BlockFilter }) {
  const h = t.rowHeight;
  const home = row.side === "HOME";
  const icon = Math.round(h * 0.5);
  const gap = Math.round(h * 0.18);
  const max = Math.min(px(26, g.k), Math.round(h * 0.4));
  const tagSize = Math.max(10, Math.round(h * 0.2));
  const tagWidth = row.breakLabel ? Math.ceil(row.breakLabel.length * tagSize * 0.72) + tagSize * 2 + gap : 0;
  const scoreSize = Math.round(max * 0.95);
  const scoreWidth = row.scoreLabel ? Math.ceil(row.scoreLabel.length * scoreSize * 0.62) + gap : 0;
  const textWidth = t.sideWidth - icon - gap - tagWidth - scoreWidth;
  const main = [row.text, row.mark].filter(Boolean).join(" ");
  const withDetail = row.detail ? `${main}   ${row.detail}` : main;
  const fullSize = fitFontSize(withDetail, textWidth, max, GEIST_EM, 10);
  // Ayrıntı (çıkan oyuncu / girenler) ancak ad küçülmeden sığıyorsa yazılır.
  const showDetail = row.detail !== null && fullSize >= Math.round(max * 0.8);
  const size = showDetail ? fullSize : fitFontSize(main, textWidth, max, GEIST_EM, 10);
  const layer = stackLayer(index);
  const accent = card.accentHex;
  const sideBox = home ? { left: g.box.left, width: t.center - t.pillWidth / 2 - px(14, g.k) - g.box.left } : { left: t.center + t.pillWidth / 2 + px(14, g.k), width: g.box.right - (t.center + t.pillWidth / 2 + px(14, g.k)) };
  const text = (
    <div tw="flex items-center" style={{ maxWidth: textWidth, flexDirection: home ? "row-reverse" : "row" }}>
      <span style={{ fontFamily: BODY, fontWeight: 800, fontSize: size, lineHeight: 1, color: "#fff", letterSpacing: size * 0.02, textShadow: TEXT_SHADOW }}>{main}</span>
      {showDetail ? <span style={{ fontFamily: BODY, fontWeight: 600, fontSize: Math.round(size * 0.82), lineHeight: 1, color: MUTED, margin: home ? `0 ${gap}px 0 0` : `0 0 0 ${gap}px` }}>{row.detail}</span> : null}
    </div>
  );
  const parts = [
    <div key="icon" tw="flex" style={{ width: icon, height: icon }}><EventIcon kind={row.kind} size={icon} /></div>,
    row.scoreLabel ? <span key="score" style={{ fontFamily: BODY, fontWeight: 900, fontSize: scoreSize, lineHeight: 1, color: accent, margin: `0 ${gap}px` }}>{row.scoreLabel}</span> : <div key="score" tw="flex" style={{ width: gap }} />,
    <div key="text" tw="flex">{text}</div>,
    row.breakLabel ? <div key="tag" tw="flex" style={{ margin: `0 ${gap}px` }}><BreakTag label={row.breakLabel} accent={accent} size={tagSize} /></div> : null,
  ];
  return (
    <div tw="absolute flex" style={{ left: g.box.left, top, width: g.box.right - g.box.left, height: h, opacity: layerOpacity(only, layer) }}>
      {row.breakLabel ? <div tw="absolute flex" style={{ left: 0, top: 5, width: g.box.right - g.box.left, height: h - 10, borderRadius: 6, backgroundColor: hexAlpha(accent, 0.14) }} /> : null}
      {row.breakLabel ? <div tw="absolute flex" style={{ left: home ? 0 : g.box.right - g.box.left - 4, top: 5, width: 4, height: h - 10, backgroundColor: accent }} /> : null}
      <div tw="absolute flex items-center" style={{ left: sideBox.left - g.box.left, top: 0, width: sideBox.width, height: h, flexDirection: home ? "row-reverse" : "row" }}>
        {parts}
      </div>
      <div tw="absolute flex items-center justify-center" style={{ left: t.center - g.box.left - t.pillWidth / 2, top: Math.round(h * 0.19), width: t.pillWidth, height: Math.round(h * 0.62), borderRadius: Math.round(h * 0.31), backgroundColor: row.breakLabel ? accent : "rgba(16,18,26,0.92)", border: row.breakLabel ? "none" : "1.5px solid rgba(255,255,255,0.28)" }}>
        <span style={{ fontFamily: BODY, fontWeight: 800, fontSize: Math.round(h * 0.3), lineHeight: 1, color: row.breakLabel ? "#0B0C10" : "#fff" }}>{row.minuteLabel}</span>
      </div>
    </div>
  );
}

function Divider({ label, g, t, top, height, only }: { label: string; g: AnalysisGeometry; t: VerticalTimeline; top: number; height: number; only: BlockFilter }) {
  const size = Math.max(10, Math.round(t.rowHeight * 0.26));
  return (
    <div tw="absolute flex items-center justify-center" style={{ left: g.box.left, top, width: g.box.right - g.box.left, height, opacity: unlayered(only) }}>
      <div tw="absolute flex" style={{ left: 0, top: Math.round(height / 2), width: g.box.right - g.box.left, height: 1, backgroundColor: "rgba(255,255,255,0.3)" }} />
      <div tw="flex items-center" style={{ height: Math.round(size * 1.9), paddingLeft: size, paddingRight: size, borderRadius: size, backgroundColor: "#11131A", border: "1.5px solid rgba(255,255,255,0.35)" }}>
        <span style={{ fontFamily: BODY, fontWeight: 800, fontSize: size, lineHeight: 1, letterSpacing: size * 0.14, color: "rgba(255,255,255,0.9)" }}>{label}</span>
      </div>
    </div>
  );
}

export function VerticalTimelineBody({ card, g, only }: { card: TimelineCard; g: AnalysisGeometry; only: BlockFilter }) {
  const kinds = slotKinds(card);
  const t = verticalTimeline(g, kinds);
  let row = 0;
  let divider = 0;
  const dividers = [...card.dividers].sort((a, b) => a.beforeRow - b.beforeRow);
  return (
    <div tw="absolute flex" style={{ left: 0, top: 0, width: g.frame.width, height: g.frame.height, opacity: blockOpacity(only, "chart", STACK_LAYERS) }}>
      <div tw="absolute flex" style={{ left: t.center - 1, top: t.top, width: 2, height: t.height, backgroundColor: SPINE, opacity: unlayered(only) }} />
      {t.slots.map((slot) => {
        if (slot.kind === "divider") {
          const entry = dividers[divider++];
          return entry ? <Divider key={`d${divider}`} label={entry.label} g={g} t={t} top={slot.top} height={slot.height} only={only} /> : null;
        }
        const index = row++;
        const entry = card.rows[index];
        return entry ? <Row key={`r${index}`} row={entry} card={card} g={g} t={t} top={slot.top} index={index} only={only} /> : null;
      })}
    </div>
  );
}
