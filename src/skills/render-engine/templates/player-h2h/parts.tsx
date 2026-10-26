import type { H2HRow } from "@/types/player-h2h";
import { BODY, DISPLAY } from "../match-day/shared";

/**
 * Oyuncu karşılaştırmasının ortak yapı taşları. Önde olan değer takım renginde ve dolu, geride olan
 * soluk; eşitlikte iki taraf beyaz.
 */

export const LOSER_TEXT = "rgba(255,255,255,0.38)";
export const LOSER_BAR = "rgba(255,255,255,0.2)";

export function valueColor(row: H2HRow, side: "LEFT" | "RIGHT", hex: string): string {
  if (row.winner === "TIE") return "#fff";
  return row.winner === side ? hex : LOSER_TEXT;
}

/**
 * Değer: rakamlar Anton; yüzdede "%" küçük Geist (Anton'un yüzde glifi "0/o" gibi okunuyor — vitrinle
 * aynı çözüm, bkz. `vitrin/parts.tsx::Percent`).
 */
export function StatValue({ text, size, color, shadow, percentScale = 0.42 }: { text: string; size: number; color: string; shadow?: string; percentScale?: number }) {
  const percent = text.startsWith("%");
  return (
    <div tw="flex items-start" style={shadow ? { color, textShadow: shadow } : { color }}>
      {percent ? <span style={{ fontFamily: BODY, fontWeight: 800, fontSize: Math.round(size * percentScale), lineHeight: 1, marginTop: Math.round(size * 0.1), marginRight: Math.round(size * 0.04) }}>%</span> : null}
      <span style={{ fontFamily: DISPLAY, fontSize: size, lineHeight: 1 }}>{percent ? text.slice(1) : text}</span>
    </div>
  );
}

/** Büyük harf etiket; "xG"/"xA" olduğu gibi kalır ("XG" okunmuyor). */
export function upperLabel(label: string): string {
  return label
    .split(/(\bx[GA]\b)/u)
    .map((part) => (/^x[GA]$/u.test(part) ? part : part.toLocaleUpperCase("tr-TR")))
    .join("");
}
