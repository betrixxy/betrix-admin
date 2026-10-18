/**
 * Transfer kuralı — saf. Kişinin güncel kulübü değişince klasörü yeni takımın altına geçer:
 * ESKİ kulüp klasöründeki fotoğrafların `teamId`'si yeni kulübe taşınır, `kitTeamId` (fotoğraftaki
 * forma) AYNI kalır → arşivde "eski forma — <takım>" rozeti. Milli takım klasöründeki fotoğraflar
 * ve başka takım klasörlerindekiler dokunulmaz. Fotoğraf silinmez.
 */

export interface TransferPhoto {
  id: string;
  teamId: number;
  kitTeamId: number;
}

export interface TransferPlan {
  /** Klasörü yeni kulübe geçecek fotoğraflar. */
  moveIds: string[];
  /** Taşındıktan sonra "eski forma" rozeti alacak olanlar (forma ≠ yeni klasör). */
  oldKitIds: string[];
}

export function planTransfer(photos: TransferPhoto[], oldTeamId: number | null, newTeamId: number): TransferPlan {
  if (oldTeamId === null || oldTeamId === newTeamId) return { moveIds: [], oldKitIds: [] };
  const moving = photos.filter((photo) => photo.teamId === oldTeamId);
  return { moveIds: moving.map((photo) => photo.id), oldKitIds: moving.filter((photo) => photo.kitTeamId !== newTeamId).map((photo) => photo.id) };
}

/** Arşiv kartının forma rozeti: forma takımı klasör takımından farklıysa "eski forma". */
export function isOldKit(photo: { teamId: number; kitTeamId: number }): boolean {
  return photo.kitTeamId !== photo.teamId;
}
