import { trailHex } from "@/lib/dashboard/match-stats-theme";
import type { MatchStatsCard, StatCardRow, StatTone } from "@/types/match-stats";
import { BODY, DISPLAY, px } from "../match-day/shared";

/**
 * Maç İstatistikleri satırı — "omurga" düzeni (Satori). Değerler sabit sütunlarda: ev sahibi
 * panelin sol iç kenarında sağa yaslı, deplasman sağ iç kenarda sola yaslı; çubuklar omurgadan bu
 * sütunlara doğru uzar (azami boy = omurga ile değer sütunu arası, panel dolar). Etiket satırın
 * üstünde ortada (Geist). Önde olan taraf tam takım rengi, geride kalan aynı tonun koyu-doygun hâli
 * (`trailHex`); nötr satırlar gümüş. Top hakimiyeti "kahraman" satırdır: panel genişliğinde, iki
 * kat kalın tek bölünmüş çubuk, 1,4× değerler. Tüm metinlerde `lineHeight` sabit — yükseklikler
 * `stats-card.tsx`'te hesaplanır.
 */

export const SILVER = "#C9CED6";
const EMPTY = "rgba(255,255,255,0.14)";
const TRACK = "rgba(255,255,255,0.06)";

/** Satır ölçüleri (k ile ölçeklenir). */
export const ROW = {
  label: 22,
  labelGap: 8,
  value: 36,
  bar: 12,
  /** Değer sütunu genişliği ("%88", "685"). */
  valueColumn: 118,
  /** Değer sütunu ile çubuk bölgesi arası. */
  valueGap: 16,
  /** Omurganın iki yanındaki boşluk (çubuklar omurgaya değmez). */
  spineGap: 10,
} as const;

/** Kahraman satır (top hakimiyeti): değerler 1,4×, çubuk 2×. */
export const HERO = { value: 56, bar: 24 } as const;

export const rowHeight = (k: number) => px(ROW.label, k) + px(ROW.labelGap, k) + px(ROW.value, k);
export const heroRowHeight = (k: number) => px(ROW.label, k) + px(ROW.labelGap, k) + px(HERO.value, k);

export function rgba(hex: string, alpha: number): string {
  const value = Number.parseInt(hex.replace("#", ""), 16);
  return `rgba(${(value >> 16) & 255},${(value >> 8) & 255},${value & 255},${alpha})`;
}

function barColor(tone: StatTone, hex: string): string {
  if (tone === "neutral") return rgba(SILVER, 0.75);
  return tone === "lead" ? hex : trailHex(hex);
}

function valueColor(tone: StatTone): string {
  if (tone === "neutral") return "rgba(255,255,255,0.88)";
  return tone === "lead" ? "white" : "rgba(255,255,255,0.6)";
}

/** Sayı Anton; yüzde işareti Geist ve küçük — Anton'un "%" glifi "0/0" gibi okunur. */
function Value({ text, tone, size, width, align }: { text: string; tone: StatTone; size: number; width: number; align: "left" | "right" }) {
  const percent = text.startsWith("%");
  const color = valueColor(tone);
  return (
    <div tw="flex items-end" style={{ width, height: size, justifyContent: align === "right" ? "flex-end" : "flex-start" }}>
      {percent ? (
        <span style={{ fontFamily: BODY, fontWeight: 800, fontSize: Math.round(size * 0.56), lineHeight: 1, color, marginRight: Math.round(size * 0.06), paddingBottom: Math.round(size * 0.08) }}>%</span>
      ) : null}
      <span style={{ fontFamily: DISPLAY, fontSize: size, lineHeight: 1, color }}>{percent ? text.slice(1) : text}</span>
    </div>
  );
}

function Label({ text, k }: { text: string; k: number }) {
  const size = px(ROW.label, k);
  return (
    <span style={{ fontFamily: BODY, fontWeight: 700, fontSize: size, lineHeight: 1, height: size, letterSpacing: px(1.4, k), color: "rgba(255,255,255,0.66)" }}>
      {/* Kart oluşturucu büyük harfe çevirir (`upperLabel` — "xG" gibi muaf parçalar korunur). */}
      {text}
    </span>
  );
}

/** Sütun genişlikleri — satır ve omurga aynı sayıları okur. */
export function rowColumns(width: number, k: number) {
  const valueColumn = px(ROW.valueColumn, k);
  const valueGap = px(ROW.valueGap, k);
  const spineGap = px(ROW.spineGap, k);
  const zone = Math.floor((width - 2 * valueColumn - 2 * valueGap - 2 * spineGap) / 2);
  return { valueColumn, valueGap, spineGap, zone, center: width - 2 * valueColumn - 2 * valueGap - 2 * zone };
}

/** Omurgadan dışa iki çubuk; değerler kenardaki sabit sütunlarda. */
export function SpineRow({ row, card, width, k }: { row: StatCardRow; card: MatchStatsCard; width: number; k: number }) {
  const c = rowColumns(width, k);
  const height = px(ROW.bar, k);
  const bar = (side: "home" | "away") => {
    const share = side === "home" ? row.bar.home : row.bar.away;
    const tone = side === "home" ? row.homeTone : row.awayTone;
    const length = row.bar.empty ? px(6, k) : Math.round(c.zone * share);
    const color = row.bar.empty ? EMPTY : barColor(tone, side === "home" ? card.homeHex : card.awayHex);
    return (
      <div tw="flex items-center" style={{ width: c.zone, height: px(ROW.value, k), justifyContent: side === "home" ? "flex-end" : "flex-start" }}>
        <div tw="flex" style={{ width: length, height, borderRadius: height / 2, backgroundColor: color }} />
      </div>
    );
  };
  return (
    <div tw="flex flex-col items-center" style={{ width }}>
      <Label text={row.label} k={k} />
      <div tw="flex items-center" style={{ marginTop: px(ROW.labelGap, k) }}>
        <Value text={row.homeText} tone={row.homeTone} size={px(ROW.value, k)} width={c.valueColumn} align="right" />
        <div tw="flex" style={{ width: c.valueGap }} />
        {bar("home")}
        <div tw="flex" style={{ width: c.center }} />
        {bar("away")}
        <div tw="flex" style={{ width: c.valueGap }} />
        <Value text={row.awayText} tone={row.awayTone} size={px(ROW.value, k)} width={c.valueColumn} align="left" />
      </div>
    </div>
  );
}

/** Kahraman satır: değer sütunları arasında tek, kalın bölünmüş çubuk (top hakimiyeti, toplam 100). */
export function HeroRow({ row, card, width, k }: { row: StatCardRow; card: MatchStatsCard; width: number; k: number }) {
  const c = rowColumns(width, k);
  const span = width - 2 * c.valueColumn - 2 * c.valueGap;
  const gap = px(4, k);
  const height = px(HERO.bar, k);
  const total = row.bar.home + row.bar.away;
  const homeWidth = Math.round((span - gap) * (total > 0 ? row.bar.home / total : 0.5));
  const fill = (tone: StatTone, hex: string) => (row.bar.empty ? EMPTY : barColor(tone, hex));
  return (
    <div tw="flex flex-col items-center" style={{ width }}>
      <Label text={row.label} k={k} />
      <div tw="flex items-center" style={{ marginTop: px(ROW.labelGap, k) }}>
        <Value text={row.homeText} tone={row.homeTone} size={px(HERO.value, k)} width={c.valueColumn} align="right" />
        <div tw="flex" style={{ width: c.valueGap }} />
        <div tw="flex items-center" style={{ width: span, height: px(HERO.value, k) }}>
          <div tw="flex" style={{ width: span, height, borderRadius: height / 2, backgroundColor: TRACK }}>
            <div tw="flex" style={{ width: homeWidth, height, borderRadius: height / 2, backgroundColor: fill(row.homeTone, card.homeHex) }} />
            <div tw="flex" style={{ width: gap }} />
            <div tw="flex" style={{ width: span - homeWidth - gap, height, borderRadius: height / 2, backgroundColor: fill(row.awayTone, card.awayHex) }} />
          </div>
        </div>
        <div tw="flex" style={{ width: c.valueGap }} />
        <Value text={row.awayText} tone={row.awayTone} size={px(HERO.value, k)} width={c.valueColumn} align="left" />
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
