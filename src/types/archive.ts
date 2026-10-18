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

/** Stüdyo arşiv seçicisi — fotoğrafın sıradaki yeri (bu maç · güncel forma · eski forma). */
export type PickerBucket = "THIS_MATCH" | "CURRENT_KIT" | "OLD_KIT";

export interface PickerPhoto {
  id: string;
  /** Arşivdeki orijinal (küçük resim olarak gösterilir). */
  url: string;
  caption: string;
  kind: PhotoKindId;
  kitTeamName: string;
  bucket: PickerBucket;
  width: number;
  height: number;
}

export interface PickerSubject {
  /** "team:<teamId>" | "person:<personId>" */
  key: string;
  label: string;
  /** API-Football oyuncu/teknik direktör kimliği; takım fotoğrafında null. */
  personApiId: number | null;
  /** "MAÇIN OYUNCUSU" kuralı yalnızca oyuncuda anlamlı. */
  isPlayer: boolean;
}

export interface ArchivePickerTeam {
  teamId: number;
  name: string;
  /** Sabit sıra: Takım Fotoğrafları, Teknik Direktör, Kaleciler, Defans, Orta Saha, Forvet. */
  groups: { group: string; label: string; subjects: PickerSubject[] }[];
  photos: Record<string, PickerPhoto[]>;
}

export interface ArchivePickerData {
  teams: ArchivePickerTeam[];
  warnings: string[];
  error?: string;
}
