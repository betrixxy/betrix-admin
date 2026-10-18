import type { ReactNode } from "react";
import type { MatchStatsCard } from "@/types/match-stats";
import { BODY, px } from "../match-day/shared";
import type { StatsGeometry } from "./geometry";
import { blockOpacity, type BlockFilter } from "../checkmatch-set/blocks";
import { HeroRow, heroRowHeight, rgba, ROW, rowHeight, SpineRow } from "./parts";

/**
 * Maç İstatistikleri satır paneli yerleşimi — dikey (4:5, 1:1, 9:16) ve 16:9 düzeni AYNI hesabı
 * kullanır. Konumlar burada hesaplanır (Satori ölçüm vermez): panel kalan alanda dikeyde
 * ortalanır, satır aralığı boşluğa göre büyür/daralır — etiket boyu hiç küçülmez.
 */

export const PANEL = "rgba(7,8,12,0.42)";
export const SPINE_ALPHA = 0.6;
const PAD_Y = 24;
export const PAD_X = 36;
export const TITLE = 16;
const TITLE_GAP = 14;
const SECTION_GAP = 26;
/** Satır aralığı sınırları — 8 satır sığsın diye alt sınır düşük. */
const MIN_GAP = 6;
const MAX_GAP = 46;
/** Panel ile öne çıkan satır arasında görünür omurga parçası. */
export const CONNECTOR = 22;
/** Omurga etiketin üst/alt kenarından bu kadar uzakta kesilir. */
const LABEL_CLEARANCE = 7;
/** Dipnot fontu — etiketten (22) küçük; 15 → 18 (+%20, telefonda okunurluk). */
const FOOTNOTE = 18;
/** Kelime arası boşluk (em) — Geist'in normal boşluk genişliğine yakın. */
const FOOTNOTE_WORD_GAP = 0.28;
/** Harf başına eksi aralık (em) — glif genişlikleri tek tek ölçüldüğünde oluşan fazlayı geri alır. */
const FOOTNOTE_TRACKING = -0.045;
const FOOTNOTE_LINE = 1.3;
const FOOTNOTE_GAP = 16;
/** Geist normal ağırlıkta karakter başına yaklaşık genişlik (em). */
const FOOTNOTE_EM_PER_CHAR = 0.5;

interface PlacedRow {
  key: string;
  top: number;
  node: ReactNode;
}

export interface Layout {
  panelTop: number;
  panelHeight: number;
  rows: PlacedRow[];
  titles: { key: string; top: number; text: string }[];
  /** Omurganın kesildiği y aralıkları (satır etiketleri, dipnot). */
  cuts: [number, number][];
  /** Omurganın panel içindeki başlangıcı (kahraman satırın altı ya da ilk satırın üstü). */
  spineFrom: number;
  footnote: { top: number; height: number } | null;
}

/** Özet sayfasının ilk satırı top hakimiyetiyse kahraman satır olarak çizilir. */
const isHero = (card: MatchStatsCard, key: string, index: number) => card.page === "SUMMARY" && index === 0 && key === "possession";

function footnoteHeight(card: MatchStatsCard, inner: number, k: number): number {
  if (!card.footnote) return 0;
  const lines = Math.max(1, Math.ceil((card.footnote.length * FOOTNOTE_EM_PER_CHAR * px(FOOTNOTE, k)) / inner));
  return Math.round(lines * px(FOOTNOTE, k) * FOOTNOTE_LINE);
}

export function layout(card: MatchStatsCard, g: StatsGeometry, areaTop: number, areaBottom: number, inner: number): Layout {
  const { k } = g;
  const rowH = rowHeight(k);
  const rowCount = card.sections.reduce((sum, section) => sum + section.rows.length, 0);
  const hero = card.sections[0]?.rows[0] && isHero(card, card.sections[0].rows[0].key, 0);
  const rowsHeight = rowCount * rowH + (hero ? heroRowHeight(k) - rowH : 0);
  const titled = card.sections.filter((section) => section.title).length;
  const note = footnoteHeight(card, inner, k);
  const fixed =
    2 * px(PAD_Y, k) +
    rowsHeight +
    titled * px(TITLE + TITLE_GAP, k) +
    Math.max(0, card.sections.length - 1) * px(SECTION_GAP, k) +
    (note ? px(FOOTNOTE_GAP, k) + note : 0);
  const available = areaBottom - areaTop;
  const gaps = Math.max(1, rowCount - card.sections.length);
  const gap = Math.max(px(MIN_GAP, k), Math.min(px(MAX_GAP, k), Math.floor((available - fixed) / (gaps + 2))));
  const panelHeight = fixed + gaps * gap;
  const panelTop = areaTop + Math.max(0, Math.round((available - panelHeight) / 2));

  const rows: PlacedRow[] = [];
  const titles: Layout["titles"] = [];
  const cuts: Layout["cuts"] = [];
  let y = panelTop + px(PAD_Y, k);
  let spineFrom = y;
  let flat = 0;
  card.sections.forEach((section, sectionIndex) => {
    if (sectionIndex > 0) y += px(SECTION_GAP, k);
    if (section.title) {
      titles.push({ key: section.title, top: y, text: section.title });
      y += px(TITLE + TITLE_GAP, k);
    }
    section.rows.forEach((row, index) => {
      if (index > 0) y += gap;
      const heroRow = isHero(card, row.key, flat++);
      rows.push({ key: row.key, top: y, node: heroRow ? <HeroRow row={row} card={card} width={inner} k={k} /> : <SpineRow row={row} card={card} width={inner} k={k} /> });
      if (heroRow) {
        y += heroRowHeight(k);
        spineFrom = y + px(LABEL_CLEARANCE, k);
        return;
      }
      cuts.push([y, y + px(ROW.label, k)]);
      y += rowH;
    });
  });
  let footnote: Layout["footnote"] = null;
  if (note) {
    y += px(FOOTNOTE_GAP, k);
    footnote = { top: y, height: note };
    cuts.push([y, y + note]);
  }
  return { panelTop, panelHeight, rows, titles, cuts, spineFrom, footnote };
}

/** Omurga parçaları: panelin içinden başlık yuvasına kadar, kesim aralıklarında boşluk. */
export function Spine({ x, from, to, cuts, hex, k }: { x: number; from: number; to: number; cuts: [number, number][]; hex: string; k: number }) {
  const clearance = px(LABEL_CLEARANCE, k);
  const pieces: [number, number][] = [];
  let start = from;
  for (const [top, bottom] of cuts) {
    if (top - clearance > start) pieces.push([start, top - clearance]);
    start = Math.max(start, bottom + clearance);
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

/**
 * Dipnot harf harf çizilir. Satori, Geist'te kelimenin genişliğini kerning'siz ölçüp glifleri
 * kerning'li çiziyor: fark kelimedeki dar harf (i, l, n) sayısıyla büyür ve kelime sonlarında
 * eşitsiz boşluk ("Pozisyonların  gole") bırakır; `wordSpacing`/`letterSpacing` bunu düzeltmez.
 * Tek glifte kerning çifti olmadığından ölçü = çizim; harfler hafif eksi aralıkla doğal
 * yoğunluğa çekilir, kelime araları sabit. Kelime alt satıra kayabilir (yükseklik `footnoteHeight`).
 */
export function Footnote({ text, left, top, width, height, k }: { text: string; left: number; top: number; width: number; height: number; k: number }) {
  const size = px(FOOTNOTE, k);
  const style = { fontFamily: BODY, fontWeight: 400, fontSize: size, lineHeight: FOOTNOTE_LINE, color: "rgba(255,255,255,0.55)" };
  const tracking = size * FOOTNOTE_TRACKING;
  const words = text.split(/\s+/).filter(Boolean);
  return (
    <div tw="absolute flex flex-wrap justify-center" style={{ left, top, width, height }}>
      {words.map((word, index) => {
        const glyphs = [...word];
        return (
          <div key={`${word}-${index}`} tw="flex" style={{ marginRight: index < words.length - 1 ? Math.round(size * FOOTNOTE_WORD_GAP) : 0 }}>
            {glyphs.map((glyph, position) => (
              <span key={position} style={{ ...style, marginRight: position < glyphs.length - 1 ? tracking : 0 }}>
                {glyph}
              </span>
            ))}
          </div>
        );
      })}
    </div>
  );
}


/**
 * Satır paneli: zemin + omurga + bölüm başlıkları + satırlar + dipnot. Omurga dekordur — yerleşim
 * kontrolünde ölçülmez (`only` verilince gizlenir); panelin geri kalanı "panel" bloğudur.
 */
export function StatsPanel({
  card,
  placed,
  left,
  width,
  k,
  spineTo,
  only,
}: {
  card: MatchStatsCard;
  placed: Layout;
  left: number;
  width: number;
  k: number;
  /** Omurganın bittiği y (dikeyde set bloğuna iner; 16:9'da panelin altında biter). */
  spineTo: number;
  only?: BlockFilter;
}) {
  const inner = width - 2 * px(PAD_X, k);
  const opacity = blockOpacity(only, "panel");
  return (
    <>
      <div
        tw="absolute flex"
        style={{ left, top: placed.panelTop, width, height: placed.panelHeight, borderRadius: px(28, k), backgroundColor: PANEL, border: "1px solid rgba(255,255,255,0.07)", opacity }}
      />
      {only ? null : <Spine x={left + width / 2} from={placed.spineFrom} to={spineTo} cuts={placed.cuts} hex={card.accentHex} k={k} />}
      {placed.titles.map((title) => (
        <span
          key={title.key}
          tw="absolute"
          style={{ left: left + px(PAD_X, k), top: title.top, fontFamily: BODY, fontWeight: 800, fontSize: px(TITLE, k), lineHeight: 1, letterSpacing: px(4, k), color: card.accentHex, opacity }}
        >
          {title.text}
        </span>
      ))}
      {placed.rows.map((row) => (
        <div key={row.key} tw="absolute flex" style={{ left: left + px(PAD_X, k), top: row.top, opacity }}>
          {row.node}
        </div>
      ))}
      {card.footnote && placed.footnote ? (
        <div tw="absolute flex" style={{ left: 0, top: 0, opacity }}>
          <Footnote text={card.footnote} left={left + px(PAD_X, k)} top={placed.footnote.top} width={inner} height={placed.footnote.height} k={k} />
        </div>
      ) : null}
    </>
  );
}
