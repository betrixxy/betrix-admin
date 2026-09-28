/** Bkz. CLAUDE.md 1.11 — medya/referans kütüphanesi tipleri. prisma `MediaCategory` ile birebir. */

export const MEDIA_CATEGORIES = ["LOGO", "PLAYER", "REFERENCE"] as const;
export type MediaCategory = (typeof MEDIA_CATEGORIES)[number];

export interface MediaAssetView {
  id: string;
  category: MediaCategory;
  label: string;
  fileUrl: string;
  width: number;
  height: number;
  sizeBytes: number;
  hasAlpha: boolean;
  teamId: string | null;
  teamName: string | null;
  /** ISO 8601, UTC */
  createdAt: string;
}

/** Stüdyo formundaki "kütüphaneden seç" listeleri için hafif seçenek. */
export interface MediaAssetOption {
  id: string;
  label: string;
  fileUrl: string;
}

export interface MediaActionState {
  error?: string;
  notice?: string;
}
