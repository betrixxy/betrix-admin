import type { ArchivePickerData, PickerPhoto } from "@/types/archive";

/**
 * Arşiv seçicisinin AÇILIŞ seçimi (saf, istemci de kullanır). Maç Sonucu'nda fotoğrafın kişisi ve forması
 * varsayılan olarak KAZANAN takımdan gelir (kurucu kararı 2026-10-30; beraberlikte ev sahibi) — eskiden listedeki
 * ilk fotoğraflı oyuncu (ev sahibinin kalecisi) seçiliyordu. Sıra:
 *  1. Maçın oyuncusu (MVP) kazanan takımdaysa ve kazananın formalı fotoğrafı varsa → o.
 *  2. Kazananın formalı, BU MAÇIN fotoğrafı olan ilk oyuncusu (grup sırası).
 *  3. Kazananın takım fotoğrafı (formalı).
 *  4. Kazananın formalı fotoğrafı olan ilk oyuncusu.
 *  5. Hiç fotoğraf yoksa: MVP konusu ya da kazananın takım fotoğrafı konusu — yükleme açılır, forma = kazanan.
 * Seçilen fotoğraf, konunun kazanan formalı İLK fotoğrafıdır (ızgara sırası: bu maç → güncel → eski forma).
 *
 * Fal YOKSA (`falAvailable: false`, canlı test 2026-10-31: varsayılan 864×486 takım fotoğrafı ESRGAN'sız kart üretemedi):
 * aynı sıra önce yalnızca KARTA HAZIR fotoğraflarla denenir — büyütülmüş sürümü olan ya da kısa kenarı ≥ 1080
 * (`PHOTO_MIN_SHORT_SIDE`, kalite kapısının büyütme eşiği); hiçbiri yoksa normal sıra (kart yine üretilir, orijinal
 * çözünürlükle — "Düşük çözünürlük" uyarısı).
 */

/** Kalite kapısının büyütme eşiği (`match-photo/quality.ts::PHOTO_MIN_SHORT_SIDE`) — istemci modülü sunucu dosyasını içe aktarmaz. */
export const CARD_READY_SHORT_SIDE = 1080;

/** Saf: fotoğraf Fal'sız karta hazır mı (büyütülmüş sürüm var ya da yeterince büyük). */
export const isCardReady = (photo: Pick<PickerPhoto, "upscaled" | "width" | "height">): boolean => photo.upscaled || Math.min(photo.width, photo.height) >= CARD_READY_SHORT_SIDE;

export interface PreferredSubject {
  /** Kazanan takım (beraberlikte ev sahibi) — forma takımı da budur. */
  teamId: number;
  /** Kazanan takımdaki MVP; yoksa null. */
  playerId: number | null;
  /** false → Fal yok: önce karta hazır fotoğraflar (bkz. `isCardReady`). Verilmezse true. */
  falAvailable?: boolean | undefined;
}

export interface PickerDefault {
  subjectKey: string;
  photoId: string | null;
}

/** Saf: Maç Sonucu'nun tercih ettiği konu — kazanan (beraberlikte ev sahibi) + kazanandaki MVP. */
export function winnerPhotoPreference(facts: { outcome: "HOME" | "AWAY" | "DRAW"; home: { id: number }; away: { id: number }; mvp: { playerId: number; side: "HOME" | "AWAY" } | null }): PreferredSubject {
  const side = facts.outcome === "AWAY" ? "AWAY" : "HOME";
  const teamId = side === "HOME" ? facts.home.id : facts.away.id;
  return { teamId, playerId: facts.mvp && facts.mvp.side === side ? facts.mvp.playerId : null };
}

/** Saf: tercih edilen konu ve fotoğrafı; tercih edilen takım arşivde yoksa null (seçici eski kuralına döner). */
export function preferredPickerDefault(data: ArchivePickerData, preferred: PreferredSubject): PickerDefault | null {
  if (preferred.falAvailable === false) {
    const ready = pickDefault(data, preferred, isCardReady);
    if (ready?.photoId) return ready;
  }
  return pickDefault(data, preferred, () => true);
}

function pickDefault(data: ArchivePickerData, preferred: PreferredSubject, accept: (photo: PickerPhoto) => boolean): PickerDefault | null {
  const team = data.teams.find((entry) => entry.teamId === preferred.teamId);
  if (!team) return null;
  const kit = (key: string): PickerPhoto[] => (team.photos[key] ?? []).filter((photo) => photo.kitTeamId === preferred.teamId && accept(photo));
  const subjects = team.groups.flatMap((group) => group.subjects);
  const players = subjects.filter((subject) => subject.isPlayer);
  const teamKey = subjects.find((subject) => subject.key.startsWith("team:"))?.key ?? null;
  const pick = (key: string | null | undefined): PickerDefault | null => (key && kit(key)[0] ? { subjectKey: key, photoId: kit(key)[0]?.id ?? null } : null);

  const mvpKey = preferred.playerId === null ? null : (players.find((subject) => subject.personApiId === preferred.playerId)?.key ?? null);
  const uploadKey = mvpKey ?? teamKey;
  return (
    pick(mvpKey) ??
    pick(players.find((subject) => kit(subject.key).some((photo) => photo.bucket === "THIS_MATCH"))?.key) ??
    pick(teamKey) ??
    pick(players.find((subject) => kit(subject.key).length > 0)?.key) ??
    (uploadKey ? { subjectKey: uploadKey, photoId: null } : null)
  );
}
