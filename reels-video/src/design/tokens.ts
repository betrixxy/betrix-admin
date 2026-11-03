import type { CSSProperties } from "react";
import type { DesignDirection } from "../schema";

/**
 * Üç tasarım yönünün ölçüleri. Yönler renk değişimi değil, ayrı görsel dildir; sahne şablonu ortak, kimlik buradan gelir.
 *
 * Güvenli alan: Instagram, TikTok ve Shorts'un kesişimi. Platformların resmî piksel değeri yok, kaynaklar ayrışıyor;
 * yayınlanan rehberlerdeki sağ eylem sütunu (Shorts ~%18,6 ≈ 200 px), alt yazı bandı (~420 px) ve üst (CLAUDE.md 3.3: 250 px)
 * değerlerinin en temkinlisi alındı. Telefonda doğrulanmalı.
 */
export const STRICT_SAFE = { top: 252, bottom: 420, left: 90, right: 200 } as const;
export const X = STRICT_SAFE.left;
export const W = 1080 - STRICT_SAFE.left - STRICT_SAFE.right;
export const BOTTOM = 1920 - STRICT_SAFE.bottom;
export const HUD_TOP = STRICT_SAFE.top;
export const TITLE_TOP = 322;
export const PROGRESS_TOP = BOTTOM - 8;
/** Şablon alt sınırları. */
export const MIN_HERO_PX = 160;
export const MIN_SUPPORT_PX = 48;

export interface Theme {
  id: DesignDirection;
  name: string;
  /** Başlık, rakam, etiket: yön başına en fazla 3 aile. */
  display: string;
  displayItalic: boolean;
  number: string;
  numberWeight: number;
  /** Fontta tabular rakam yoksa sabit hücre genişliği (em). */
  digitEm: number | null;
  label: string;
  labelWeight: number;
  titleWeight: number;
  titleMax: number;
  /** Başlık yazı tipinin ortalama harf genişliği (em). */
  titleWidth: number;
  titleUpper: boolean;
  heroSize: number;
  supportSize: number;
  labelSize: number;
  accent: string;
  accentInk: string;
  ink: string;
  ink2: string;
  panel: string;
  panelEdge: string;
  stage: string;
  /** Mono yazı yalnız C yönünde tasarımın parçası. */
  monoWordsAllowed: boolean;
}

export const THEMES: Record<DesignDirection, Theme> = {
  A: {
    id: "A", name: "Yayın",
    display: "Anton", displayItalic: false, number: "Anton", numberWeight: 400, digitEm: 0.5, label: "Saira Extra Condensed", labelWeight: 700,
    titleWeight: 400, titleMax: 112, titleWidth: 0.47, titleUpper: true,
    heroSize: 270, supportSize: 72, labelSize: 36,
    accent: "#C9FF2F", accentInk: "#0A0D04", ink: "#FFFFFF", ink2: "#E4E8EC", panel: "rgba(6,8,12,0.88)", panelEdge: "rgba(255,255,255,0.16)", stage: "backgrounds/stadium-night.jpg",
    monoWordsAllowed: false,
  },
  B: {
    id: "B", name: "Dergi",
    display: "DM Serif Display", displayItalic: true, number: "DM Serif Display", numberWeight: 400, digitEm: 0.545, label: "Geist", labelWeight: 500,
    titleWeight: 400, titleMax: 118, titleWidth: 0.5, titleUpper: false,
    heroSize: 280, supportSize: 72, labelSize: 30,
    accent: "#FFC857", accentInk: "#191307", ink: "#FBF6EA", ink2: "#E6DFCF", panel: "rgba(14,12,9,0.9)", panelEdge: "rgba(251,246,234,0.28)", stage: "backgrounds/crowd-bokeh.jpg",
    monoWordsAllowed: false,
  },
  C: {
    id: "C", name: "Veri laboratuvarı",
    display: "Unbounded", displayItalic: false, number: "JetBrains Mono", numberWeight: 800, digitEm: null, label: "JetBrains Mono", labelWeight: 500,
    titleWeight: 800, titleMax: 76, titleWidth: 0.84, titleUpper: true,
    heroSize: 236, supportSize: 62, labelSize: 27,
    accent: "#3DFFB5", accentInk: "#04140E", ink: "#F2FFFA", ink2: "#CFE5DC", panel: "rgba(4,12,14,0.86)", panelEdge: "rgba(61,255,181,0.34)", stage: "backgrounds/stadium-night.jpg",
    monoWordsAllowed: true,
  },
};

export const titleSize = (theme: Theme, line1: string, line2: string): number => {
  const longest = Math.max(line1.length, line2.length, 1);
  return Math.min(theme.titleMax, Math.floor(W / (longest * theme.titleWidth)));
};

export const numberStyle = (theme: Theme, size: number): CSSProperties => ({ fontFamily: theme.number, fontWeight: theme.numberWeight, fontSize: size, lineHeight: 1, fontVariantNumeric: "tabular-nums lining-nums", fontFeatureSettings: '"tnum" 1, "lnum" 1' });
export const labelStyle = (theme: Theme, size: number = theme.labelSize): CSSProperties => ({ fontFamily: theme.label, fontWeight: theme.labelWeight, fontSize: size, lineHeight: 1.12, color: theme.ink2 });

/** Takım rengi hiç yazı rengi olmaz (kontrast garantisi yok): kimliği işaret taşır. */
export const sideColor = (side: "home" | "away" | "draw" | null, colors: { home: string; away: string }, fallback: string): string =>
  side === "home" ? colors.home : side === "away" ? colors.away : side === "draw" ? "#A8B2AE" : fallback;
