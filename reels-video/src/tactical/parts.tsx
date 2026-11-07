import type { CSSProperties, ReactNode } from "react";
import { BRAND_GREEN } from "../design/tokens";

/**
 * Ortak ölçüler. Güvenli alan (CLAUDE.md, `STRICT_SAFE`): üst 252, alt 420, sol 90, sağ 200. Dikey düzen (2026-11-07, öğeler arası
 * en az 24 px — `GAP`, kare başına DOM denetimi `audit.tsx`):
 *   252–296 logo + site · 320–380 küçük maç bandı · 404–440 sayaç · 464–1402 beat içeriği · 1426–1506 altyazı · 1530–1590 kayan şerit.
 */
export const SAFE = { top: 252, bottom: 1500, left: 90, right: 880 } as const;
export const SAFE_WIDTH = SAFE.right - SAFE.left;
export const GAP = 24;
export const BAND = { top: 320, height: 60 } as const;
export const COUNTER = { top: 404, height: 36 } as const;
/** Beat içeriği: sayacın altı, altyazının üstü. */
export const CONTENT = { top: 464, bottom: 1402 } as const;
export const CAPTION = { top: 1426, bottom: 1506 } as const;
export const TICKER = { top: 1530, height: 60 } as const;
/** Hook'taki büyük maç bandı: içeriğin en altı. */
export const BIG_BAND = { top: 1242, height: 160 } as const;
export const GREEN = BRAND_GREEN;
/** Koyu zeminde yazı olarak yeşil (marka yeşili yazıda 4,5'in altında kalır). */
export const GREEN_TEXT = "#4CC456";
export const INK = "#F6F8F4";
/** Paneller TAM OPAK: altında kalan oyuncu noktası görünmez (kullanıcı 2026-11-07). */
export const PANEL = "#070D09";

export const numberFont: CSSProperties = { fontFamily: "Barlow Condensed", fontWeight: 900, fontVariantNumeric: "tabular-nums lining-nums", fontFeatureSettings: '"tnum" 1, "lnum" 1', lineHeight: 0.9 };
export const labelFont: CSSProperties = { fontFamily: "Barlow Condensed", fontWeight: 800, lineHeight: 1, letterSpacing: 1 };
export const bodyFont: CSSProperties = { fontFamily: "Geist", fontWeight: 700, lineHeight: 1.2 };

export const upper = (text: string) => text.toLocaleUpperCase("tr-TR");
/** Alan adı büyütülmez ("www.checkmatch.net"). */
export const upperKeepSite = (text: string) => upper(text).replace(/WWW\.CHECKMATCH\.NET/gu, "www.checkmatch.net");

/** Denetlenen kutu: `data-box` adı; `seeThrough` arka planı olmayan yazı (altında nokta olamaz). */
export const box = (name: string, seeThrough = false) => ({ "data-box": name, ...(seeThrough ? { "data-see-through": "1" } : {}) });

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

/** Beat başlığı: etiket + başlık (+ isteğe bağlı alt satır) tek opak panelde. */
export function Header({ tag, title, sub, size = 76 }: { tag?: string; title: string; sub?: string; size?: number }) {
  // Başlık tek satır: Barlow Condensed 800 ≈ 0,47 em/harf; sığmazsa küçülür (en az 56 px).
  const fit = Math.max(56, Math.min(size, Math.floor((SAFE_WIDTH - 60) / Math.max(1, title.length * 0.47))));
  return (
    <div {...box("başlık")} style={{ alignSelf: "flex-start", maxWidth: SAFE_WIDTH, boxSizing: "border-box", background: PANEL, borderRadius: 14, padding: "14px 22px 14px", display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 12 }}>
      {tag ? <Tag>{tag}</Tag> : null}
      <div style={{ ...labelFont, fontSize: fit, color: INK, whiteSpace: "nowrap" }}>{title}</div>
      {sub ? <div style={{ ...labelFont, fontSize: 36, color: "rgba(246,248,244,0.86)" }}>{sub}</div> : null}
    </div>
  );
}

/** Beat içerik sütunu: 464–1402 arasına yayılır (üst %60'a sıkışmaz). */
export function Column({ children, bottom = CONTENT.bottom }: { children: ReactNode; bottom?: number }) {
  return (
    <div style={{ position: "absolute", left: SAFE.left, width: SAFE_WIDTH, top: CONTENT.top, height: bottom - CONTENT.top, display: "flex", flexDirection: "column", justifyContent: "space-between", alignItems: "stretch" }}>
      {children}
    </div>
  );
}

/** Panel açılışı: saydamlık yerine yukarıdan aşağı açılır (panel hiçbir karede yarı saydam olmaz). */
export const reveal = (progress: number): CSSProperties => (progress <= 0 ? { opacity: 0 } : progress >= 1 ? {} : { clipPath: `inset(0 0 ${((1 - progress) * 100).toFixed(2)}% 0)` });
