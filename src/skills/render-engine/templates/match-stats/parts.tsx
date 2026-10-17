import type { MatchStatsCard, StatCardRow, StatTone } from "@/types/match-stats";
import { BODY, DISPLAY, px } from "../match-day/shared";

/**
 * Maç İstatistikleri satırı — "omurga" düzeni (Satori). Kartın ortasındaki dikey çizgiden iki
 * çubuk dışa büyür: ev sahibi sola, deplasman sağa; değerler çubuk uçlarının dışında, etiket
 * satırın üstünde ortada (Geist). Önde olan taraf parlak takım rengi, diğeri %45; nötr satırlar
 * gümüş. Takım renkleri yalnızca burada kullanılır — setin geri kalanı tek vurgu rengindedir.
 * Tüm metinlerde `lineHeight` sabittir: yükseklikler `stats-card.tsx`'te hesaplanır.
 */

export const SILVER = "#C9CED6";
export const TRAIL_ALPHA = 0.45;
const EMPTY = "rgba(255,255,255,0.14)";

/** Satır ölçüleri (k ile ölçeklenir). */
export const ROW = {
  label: 17,
  labelGap: 10,
  value: 40,
  bar: 12,
  /** Omurganın iki yanındaki boşluk (çubuklar omurgaya değmez). */
  spineGap: 10,
  valueGap: 14,
  /** Değer için ayrılan genişlik ("%88", "685"). */
  valueReserve: 118,
} as const;

export const rowHeight = (k: number) => px(ROW.label, k) + px(ROW.labelGap, k) + px(ROW.value, k);

export function rgba(hex: string, alpha: number): string {
  const value = Number.parseInt(hex.replace("#", ""), 16);
  return `rgba(${(value >> 16) & 255},${(value >> 8) & 255},${value & 255},${alpha})`;
}

function barColor(tone: StatTone, hex: string, empty: boolean): string {
  if (empty) return EMPTY;
  if (tone === "neutral") return rgba(SILVER, 0.75);
  return tone === "lead" ? hex : rgba(hex, TRAIL_ALPHA);
}

function valueColor(tone: StatTone): string {
  if (tone === "neutral") return "rgba(255,255,255,0.88)";
  return tone === "lead" ? "white" : `rgba(255,255,255,${TRAIL_ALPHA + 0.1})`;
}

/** Sayı Anton; yüzde işareti Geist ve küçük — Anton'un "%" glifi "0/0" gibi okunur. */
function Value({ text, tone, size }: { text: string; tone: StatTone; size: number }) {
  const percent = text.startsWith("%");
  const color = valueColor(tone);
  return (
    <div tw="flex items-end" style={{ height: size }}>
      {percent ? (
        <span style={{ fontFamily: BODY, fontWeight: 800, fontSize: Math.round(size * 0.56), lineHeight: 1, color, marginRight: Math.round(size * 0.06), paddingBottom: Math.round(size * 0.08) }}>%</span>
      ) : null}
      <span style={{ fontFamily: DISPLAY, fontSize: size, lineHeight: 1, color }}>{percent ? text.slice(1) : text}</span>
    </div>
  );
}

/** Bir tarafın yarısı: omurgaya yaslı çubuk + ucunun dışında değer. */
function Half({ row, card, side, width, k }: { row: StatCardRow; card: MatchStatsCard; side: "home" | "away"; width: number; k: number }) {
  const tone = side === "home" ? row.homeTone : row.awayTone;
  const share = side === "home" ? row.bar.home : row.bar.away;
  const maxLength = width - px(ROW.valueReserve, k) - px(ROW.valueGap, k);
  const length = Math.max(row.bar.empty ? px(6, k) : 0, Math.round(maxLength * share));
  const height = px(ROW.bar, k);
  const bar = <div tw="flex" style={{ width: length, height, borderRadius: height / 2, backgroundColor: barColor(tone, side === "home" ? card.homeHex : card.awayHex, row.bar.empty) }} />;
  const value = <Value text={side === "home" ? row.homeText : row.awayText} tone={tone} size={px(ROW.value, k)} />;
  const gap = <div tw="flex" style={{ width: px(ROW.valueGap, k) }} />;
  return (
    <div tw="flex items-center" style={{ width, height: px(ROW.value, k), justifyContent: side === "home" ? "flex-end" : "flex-start" }}>
      {side === "home" ? value : bar}
      {gap}
      {side === "home" ? bar : value}
    </div>
  );
}

export function SpineRow({ row, card, width, k }: { row: StatCardRow; card: MatchStatsCard; width: number; k: number }) {
  const half = Math.floor((width - 2 * px(ROW.spineGap, k)) / 2);
  return (
    <div tw="flex flex-col items-center" style={{ width }}>
      <span style={{ fontFamily: BODY, fontWeight: 700, fontSize: px(ROW.label, k), lineHeight: 1, height: px(ROW.label, k), letterSpacing: px(2.6, k), color: "rgba(255,255,255,0.62)" }}>
        {row.label.toLocaleUpperCase("tr-TR")}
      </span>
      <div tw="flex" style={{ marginTop: px(ROW.labelGap, k) }}>
        <Half row={row} card={card} side="home" width={half} k={k} />
        <div tw="flex" style={{ width: width - 2 * half }} />
        <Half row={row} card={card} side="away" width={half} k={k} />
      </div>
    </div>
  );
}

/** Set bloğunun başlık yuvasındaki öne çıkan satır — Maç Sonucu'ndaki "MAÇIN OYUNCUSU" yerinde, vurgu renginde. */
export function Highlight({ card, k }: { card: MatchStatsCard; k: number }) {
  if (!card.highlight) return null;
  const size = px(20, k);
  return <span style={{ fontFamily: BODY, fontWeight: 800, fontSize: size, lineHeight: 1, letterSpacing: size * 0.16, color: card.accentHex }}>{card.highlight}</span>;
}
