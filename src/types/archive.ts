/** Fotoğraf arşivi — paylaşılan tipler (bkz. CLAUDE.md 1.11, `lib/archive/`). prisma `PhotoKind` ile birebir. */

export const PHOTO_KINDS = ["CELEBRATION", "PORTRAIT", "ACTION", "TEAM"] as const;
export type PhotoKindId = (typeof PHOTO_KINDS)[number];

export const PHOTO_KIND_LABELS: Record<PhotoKindId, string> = {
  CELEBRATION: "Sevinç",
  PORTRAIT: "Portre",
  ACTION: "Aksiyon",
  TEAM: "Takım",
};

export interface ArchiveActionState {
  error?: string;
  notice?: string;
}
