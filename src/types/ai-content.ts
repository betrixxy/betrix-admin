/** Bkz. CLAUDE.md Bölüm 3 — Yapay Zeka İçerik Stüdyosu (AiContent) tipleri. */

/** CLAUDE.md 3.3 çoklu format tablosuyla birebir: IG Feed 4:5, Story/Reels 9:16, X 16:9. */
export const STUDIO_FORMATS = ["IG_FEED", "STORY", "X_CARD"] as const;
export type StudioFormat = (typeof STUDIO_FORMATS)[number];

export interface StudioFormatDef {
  id: StudioFormat;
  label: string;
  width: number;
  height: number;
  ratioLabel: string;
}

export interface AiContentView {
  id: string;
  fixtureId: string;
  postId: string | null;
  prompt: string;
  playerImageUrl: string | null;
  logoImageUrl: string | null;
  resultImageUrl: string | null;
  /** ISO 8601, UTC */
  createdAt: string;
}

export interface StudioPostOption {
  id: string;
  label: string;
}

export interface StudioGenerationResult {
  id: string;
  resultImageUrl: string;
  prompt: string;
  format: StudioFormat;
}

export interface StudioActionState {
  error?: string;
  result?: StudioGenerationResult;
}

export interface StudioTeamStats {
  teamName: string;
  /** Son 5 maç, en yeni sağda — örn. "WWDLW". */
  form: string;
  xgFor: number;
  xgAgainst: number;
}

export interface StudioMatchStats {
  home: StudioTeamStats;
  away: StudioTeamStats;
  /** İstatistiklerin nereden geldiği — gerçek Sportmonks bağlanana kadar "mock". */
  source: "mock" | "sportmonks";
}
