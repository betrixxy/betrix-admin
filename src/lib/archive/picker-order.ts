import type { PickerBucket } from "@/types/archive";

/**
 * Stüdyo arşiv seçicisinin sıralama kuralı — saf. Seçilen kişi/takımın fotoğrafları:
 *   1. BU MAÇIN fotoğrafları,
 *   2. güncel formalı olanlar (forma takımı = seçicinin takımı), en yeni önce,
 *   3. en altta "eski forma" olanlar (başka takımın ya da milli takımın forması), en yeni önce.
 */

export interface OrderablePhoto {
  fixtureId: string | null;
  kitTeamId: number;
  uploadedAt: Date | string;
}

export type PhotoBucket = PickerBucket;

export function photoBucket(photo: OrderablePhoto, teamId: number, fixtureId: string | null): PhotoBucket {
  if (fixtureId && photo.fixtureId === fixtureId) return "THIS_MATCH";
  return photo.kitTeamId === teamId ? "CURRENT_KIT" : "OLD_KIT";
}

const RANK: Record<PhotoBucket, number> = { THIS_MATCH: 0, CURRENT_KIT: 1, OLD_KIT: 2 };

export function orderPickerPhotos<T extends OrderablePhoto>(photos: T[], teamId: number, fixtureId: string | null): T[] {
  const time = (photo: T) => new Date(photo.uploadedAt).getTime();
  return [...photos].sort((a, b) => RANK[photoBucket(a, teamId, fixtureId)] - RANK[photoBucket(b, teamId, fixtureId)] || time(b) - time(a));
}

/** Fotoğraftaki formanın takımı; forma takımı yoksa klasörün takımı. */
export const kitTeamOf = (photo: { kitTeamId: number | null; teamId: number }): number => photo.kitTeamId ?? photo.teamId;

/**
 * "Yalnızca kendi forması" süzgeci (vitrin posteri: ev/deplasman yarısı o takımın formasıyla) — saf.
 * Eski forma (transfer öncesi kulüp, milli takım) ve başka takımın forması elenir.
 */
export function ownKitOnly<T extends { kitTeamId: number | null; teamId: number }>(photos: T[], teamId: number): T[] {
  return photos.filter((photo) => kitTeamOf(photo) === teamId);
}
