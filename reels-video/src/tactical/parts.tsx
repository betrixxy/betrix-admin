import type { CSSProperties, ReactNode } from "react";
import { BRAND_GREEN } from "../design/tokens";

/** Ortak ölçüler. Güvenli alan (CLAUDE.md, `STRICT_SAFE`): üst 252, alt 420, sol 90, sağ 200. */
export const SAFE = { top: 252, bottom: 1500, left: 90, right: 880 } as const;
export const SAFE_WIDTH = SAFE.right - SAFE.left;
/** Beat içeriği: HUD'un altı, altyazının üstü. */
export const CONTENT = { top: 446, bottom: 1290 } as const;
export const GREEN = BRAND_GREEN;
/** Koyu zeminde yazı olarak yeşil (marka yeşili yazıda 4,5'in altında kalır). */
export const GREEN_TEXT = "#4CC456";
export const INK = "#F6F8F4";
export const PANEL = "rgba(5,10,7,0.8)";

export const numberFont: CSSProperties = { fontFamily: "Barlow Condensed", fontWeight: 900, fontVariantNumeric: "tabular-nums lining-nums", fontFeatureSettings: '"tnum" 1, "lnum" 1', lineHeight: 0.9 };
export const labelFont: CSSProperties = { fontFamily: "Barlow Condensed", fontWeight: 800, lineHeight: 1, letterSpacing: 1 };
export const bodyFont: CSSProperties = { fontFamily: "Geist", fontWeight: 700, lineHeight: 1.2 };

export const upper = (text: string) => text.toLocaleUpperCase("tr-TR");

/** Yüzde: "%" işareti rakamın ~%55'i, rakamdan önce (Türkçe yazım). */
export function Percent({ value, size, color = INK, style }: { value: number; size: number; color?: string; style?: CSSProperties }) {
  return (
    <span data-audit-text="number" style={{ ...numberFont, fontSize: size, color, display: "inline-flex", alignItems: "flex-start", ...style }}>
      <span style={{ fontSize: size * 0.55, marginTop: size * 0.06, marginRight: size * 0.02 }}>%</span>
      <span>{value}</span>
    </span>
  );
}

export function Tag({ children }: { children: ReactNode }) {
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 12, background: GREEN, color: "#04140A", padding: "8px 18px 6px", borderRadius: 6, ...labelFont, fontSize: 34 }}>
      {children}
    </div>
  );
}

export function Title({ children }: { children: ReactNode }) {
  return <div style={{ ...labelFont, fontSize: 76, color: INK, marginTop: 14, textShadow: "0 3px 12px rgba(0,0,0,0.85)" }}>{children}</div>;
}
