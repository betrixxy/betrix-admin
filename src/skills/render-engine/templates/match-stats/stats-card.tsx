import type { ReactNode } from "react";
import type { MatchStatsCard } from "@/types/match-stats";
import { PageLabel, SET_VERTICAL, SetFooter, SetScoreBlock } from "../checkmatch-set/set-parts";
import { BODY, px } from "../match-day/shared";
import { PAGE_LABEL_SPACE, setBlockTop, type StatsGeometry } from "./geometry";
import { Highlight, rgba, rowHeight, SpineRow } from "./parts";

/**
 * MAÇ İSTATİSTİKLERİ — dikey (4:5, 1:1, 9:16) sayfa, "CheckMatch set" kartı: sol üstte sayfa
 * etiketi, altta Maç Sonucu ile AYNI set bloğu (öne çıkan satır · skor şeridi · golcüler) ve künye.
 * Arada satır paneli; vurgu renginde ince omurga panelin üstünden iner, her satırın etiketinde
 * kesilir ve set bloğunda turnuva rozetine ulaşır. Satır konumları burada hesaplanır (Satori ölçüm
 * vermez); panel kalan alanda dikeyde ortalanır, satır aralığı boşluğa göre büyür (ölü alan yok).
 */

const PANEL = "rgba(7,8,12,0.42)";
const SPINE_ALPHA = 0.6;
const PAD_Y = 30;
const PAD_X = 36;
const TITLE = 16;
const TITLE_GAP = 14;
const SECTION_GAP = 26;
/** Omurga etiketin üst/alt kenarından bu kadar uzakta kesilir. */
const LABEL_CLEARANCE = 7;

interface PlacedRow {
  key: string;
  top: number;
  node: ReactNode;
}

interface Layout {
  panelTop: number;
  panelHeight: number;
  rows: PlacedRow[];
  titles: { key: string; top: number; text: string }[];
  /** Etiketlerin y aralıkları — omurga bu aralıklarda kesilir. */
  labels: [number, number][];
}

function layout(card: MatchStatsCard, g: StatsGeometry, areaTop: number, areaBottom: number, inner: number): Layout {
  const { k } = g;
  const rowH = rowHeight(k);
  const rowCount = card.sections.reduce((sum, section) => sum + section.rows.length, 0);
  const titled = card.sections.filter((section) => section.title).length;
  const fixed = 2 * px(PAD_Y, k) + rowCount * rowH + titled * px(TITLE + TITLE_GAP, k) + Math.max(0, card.sections.length - 1) * px(SECTION_GAP, k);
  const available = areaBottom - areaTop;
  const gaps = Math.max(1, rowCount - card.sections.length);
  const gap = Math.max(px(12, k), Math.min(px(46, k), Math.floor((available - fixed) / (gaps + 2))));
  const panelHeight = fixed + gaps * gap;
  const panelTop = areaTop + Math.max(0, Math.round((available - panelHeight) / 2));

  const rows: PlacedRow[] = [];
  const titles: Layout["titles"] = [];
  const labels: Layout["labels"] = [];
  let y = panelTop + px(PAD_Y, k);
  card.sections.forEach((section, sectionIndex) => {
    if (sectionIndex > 0) y += px(SECTION_GAP, k);
    if (section.title) {
      titles.push({ key: section.title, top: y, text: section.title });
      y += px(TITLE + TITLE_GAP, k);
    }
    section.rows.forEach((row, index) => {
      if (index > 0) y += gap;
      rows.push({ key: row.key, top: y, node: <SpineRow row={row} card={card} width={inner} k={k} /> });
      labels.push([y, y + px(17, k)]);
      y += rowH;
    });
  });
  return { panelTop, panelHeight, rows, titles, labels };
}

/** Omurga parçaları: panelin üstünden başlık yuvasına kadar, her satır etiketinde kesilir. */
function Spine({ x, from, to, labels, hex, k }: { x: number; from: number; to: number; labels: [number, number][]; hex: string; k: number }) {
  const clearance = px(LABEL_CLEARANCE, k);
  const pieces: [number, number][] = [];
  let start = from;
  for (const [top, bottom] of labels) {
    if (top - clearance > start) pieces.push([start, top - clearance]);
    start = bottom + clearance;
  }
  if (to > start) pieces.push([start, to]);
  return (
    <>
      {pieces.map(([top, bottom]) => (
        <div key={top} tw="absolute flex" style={{ left: x - 1, top, width: 2, height: bottom - top, backgroundColor: rgba(hex, SPINE_ALPHA) }} />
      ))}
    </>
  );
}

function Vertical({ card, g }: { card: MatchStatsCard; g: StatsGeometry }) {
  const { k, frame } = g;
  const width = g.right - g.left;
  const inner = width - 2 * px(PAD_X, k);
  const spineEnd = setBlockTop(g, card.homeScorers, card.awayScorers) - px(10, k);
  const areaTop = g.top + px(PAGE_LABEL_SPACE, k);
  const areaBottom = spineEnd - px(30, k);
  const placed = layout(card, g, areaTop, areaBottom, inner);
  const spineX = g.left + width / 2;
  return (
    <div tw="relative flex h-full w-full" style={{ fontFamily: BODY }}>
      <PageLabel card={card} box={g} k={k} />
      <div
        tw="absolute flex"
        style={{ left: g.left, top: placed.panelTop, width, height: placed.panelHeight, borderRadius: px(28, k), backgroundColor: PANEL, border: "1px solid rgba(255,255,255,0.07)" }}
      />
      <Spine x={spineX} from={placed.panelTop} to={spineEnd} labels={placed.labels} hex={card.accentHex} k={k} />
      {placed.titles.map((title) => (
        <span
          key={title.key}
          tw="absolute"
          style={{ left: g.left + px(PAD_X, k), top: title.top, fontFamily: BODY, fontWeight: 800, fontSize: px(TITLE, k), lineHeight: 1, letterSpacing: px(4, k), color: card.accentHex }}
        >
          {title.text}
        </span>
      ))}
      {placed.rows.map((row) => (
        <div key={row.key} tw="absolute flex" style={{ left: g.left + px(PAD_X, k), top: row.top }}>
          {row.node}
        </div>
      ))}
      <SetScoreBlock card={card} box={g} frameHeight={frame.height} k={k} headline={<Highlight card={card} k={k} />} spineHex={rgba(card.accentHex, SPINE_ALPHA)} />
      <SetFooter card={card} box={g} size={px(SET_VERTICAL.footerSize, k)} logoHeight={px(SET_VERTICAL.logoHeight, k)} />
    </div>
  );
}

export function MatchStatsTemplate({ card, g }: { card: MatchStatsCard; g: StatsGeometry }) {
  // 16:9 iki sütunlu set yerleşimi onaydan sonra eklenecek; şimdilik yalnızca dikey aile.
  return <Vertical card={card} g={g} />;
}
