import { MATCH_DAY_FORMAT_IDS, type MatchDayFormatId } from "@/types/match-day";

/**
 * Maç Günü platform formatları (bkz. CLAUDE.md 3.3) — istemci bileşenleri de kullanır.
 * `safeTop`/`safeBottom`: platform arayüzünün kapattığı, kritik içerik konmayan bantlar.
 */
export interface MatchDayFrame {
  id: MatchDayFormatId;
  label: string;
  platform: string;
  ratioLabel: string;
  width: number;
  height: number;
  /** Dikey (4:5, 1:1, 9:16) ya da yatay (16:9) yerleşim ailesi. */
  orientation: "vertical" | "landscape";
  safeTop: number;
  safeBottom: number;
}

export const MATCH_DAY_FRAMES: Record<MatchDayFormatId, MatchDayFrame> = {
  IG_PORTRAIT: {
    id: "IG_PORTRAIT",
    label: "Instagram Gönderi",
    platform: "Instagram Feed",
    ratioLabel: "4:5",
    width: 1080,
    height: 1350,
    orientation: "vertical",
    safeTop: 0,
    safeBottom: 0,
  },
  IG_SQUARE: {
    id: "IG_SQUARE",
    label: "Instagram Kare",
    platform: "Instagram / Facebook",
    ratioLabel: "1:1",
    width: 1080,
    height: 1080,
    orientation: "vertical",
    safeTop: 0,
    safeBottom: 0,
  },
  STORY: {
    id: "STORY",
    label: "Story / Reels / TikTok",
    platform: "Instagram Story, Reels, TikTok",
    ratioLabel: "9:16",
    width: 1080,
    height: 1920,
    orientation: "vertical",
    // CLAUDE.md 3.3: üst 250px ve alt 320px platform arayüzüne ayrılır.
    safeTop: 250,
    safeBottom: 320,
  },
  X_LANDSCAPE: {
    id: "X_LANDSCAPE",
    label: "X (Twitter)",
    platform: "X / Twitter kartı",
    ratioLabel: "16:9",
    width: 1200,
    height: 675,
    orientation: "landscape",
    safeTop: 0,
    safeBottom: 0,
  },
};

export function isMatchDayFormatId(value: string): value is MatchDayFormatId {
  return MATCH_DAY_FORMAT_IDS.some((id) => id === value);
}
