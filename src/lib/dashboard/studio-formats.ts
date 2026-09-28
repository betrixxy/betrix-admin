import type { StudioFormat, StudioFormatDef } from "@/types/ai-content";

/** Bkz. CLAUDE.md 3.3 — her formatın kendi boyutu ve oranı vardır. */
export const STUDIO_FORMAT_DEFS: Record<StudioFormat, StudioFormatDef> = {
  IG_FEED: { id: "IG_FEED", label: "Instagram Feed", width: 1080, height: 1350, ratioLabel: "4:5" },
  STORY: { id: "STORY", label: "Story / Reels / TikTok", width: 1080, height: 1920, ratioLabel: "9:16" },
  X_CARD: { id: "X_CARD", label: "X (Twitter) Kartı", width: 1200, height: 675, ratioLabel: "16:9" },
};
