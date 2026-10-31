import type { ArchivePickerData, PickerPhoto } from "@/types/archive";

/**
 * Arşiv seçicisinin AÇILIŞ seçimi (saf, istemci de kullanır). Maç Sonucu'nda fotoğrafın kişisi ve forması
 * varsayılan olarak KAZANAN takımdan gelir (kurucu kararı 2026-10-30; beraberlikte ev sahibi). Kişi sırası
 * (kullanıcı kararı 2026-10-31, canlı test v2: MVP fotoğrafsızken kaleci Uğurcan Çakır seçiliyordu):
 *  1. Maçın oyuncusu (MVP) — kazanan takımdaysa.
 *  2. Kazananın golcüleri — gol sayısına göre (eşitlikte rating).
 *  3. Kazananın SAHA oyuncuları — önce BU MAÇIN fotoğrafı olanlar, sonra diğerleri (rating sırası, sonra grup sırası).
 *  4. Kazananın takım fotoğrafı.
 *  5. Kaleci — EN SON seçenek.
 *  6. Hiç fotoğraf yoksa: MVP konusu ya da kazananın takım fotoğrafı konusu — yükleme açılır, forma = kazanan.
 * Yalnızca kazanan formalı fotoğraflar sayılır; seçilen fotoğraf, konunun kazanan formalı İLK fotoğrafıdır
 * (ızgara sırası: bu maç → güncel → eski forma).
 *
 * Fal YOKSA (`falAvailable: false`, canlı test 2026-10-31: 864×486 fotoğraf ESRGAN'sız kart üretemedi): KARTA HAZIR
 * olmak (`isCardReady`: büyütülmüş sürüm ya da kısa kenar ≥ 1080) sıranın İÇİNDE bir ölçüttür — 1–4 arasında önce
 * karta hazır olanlar, sonra hazır olmayanlar; kaleci karta hazır diye saha oyuncusunun ÖNÜNE geçmez. Hazır
 * fotoğraf hiç yoksa kart yine üretilir (orijinal çözünürlük, "Düşük çözünürlük" uyarısı).
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
  /** Kazananın golcüleri (gol sayısı azalan) — verilmezse golcü adımı atlanır. */
  scorerIds?: readonly number[] | undefined;
  /** Kazananın oyuncuları rating sırasıyla (saha oyuncusu adımının sırası); verilmezse grup sırası. */
  rankedPlayerIds?: readonly number[] | undefined;
  /** false → Fal yok: önce karta hazır fotoğraflar (bkz. `isCardReady`). Verilmezse true. */
  falAvailable?: boolean | undefined;
}

export interface PickerDefault {
  subjectKey: string;
  photoId: string | null;
}

interface PreferenceFacts {
  outcome: "HOME" | "AWAY" | "DRAW";
  home: { id: number; scorers?: readonly { playerId: number | null; minutes: readonly string[] }[] };
  away: { id: number; scorers?: readonly { playerId: number | null; minutes: readonly string[] }[] };
  mvp: { playerId: number; side: "HOME" | "AWAY" } | null;
  /** MVP adayları (iki takım) — gol ve rating; varsa golcü sırası buradan. */
  players?: readonly { playerId: number; side: "HOME" | "AWAY"; rating: number | null; goals: number }[];
}

/** Saf: Maç Sonucu'nun tercih ettiği konu — kazanan (beraberlikte ev sahibi), kazanandaki MVP, golcüler, rating sırası. */
export function winnerPhotoPreference(facts: PreferenceFacts): PreferredSubject {
  const side = facts.outcome === "AWAY" ? "AWAY" : "HOME";
  const team = side === "HOME" ? facts.home : facts.away;
  const own = (facts.players ?? []).filter((player) => player.side === side);
  const byRating = [...own].sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1));
  // Gol sayısı: aday listesinden; listede yoksa golcü satırındaki dakika sayısı (kendi kalesine goller rakip oyuncudur — kazananın arşivinde bulunmaz).
  const goals = new Map<number, number>();
  for (const player of own) if (player.goals > 0) goals.set(player.playerId, player.goals);
  for (const line of team.scorers ?? []) if (line.playerId !== null && !goals.has(line.playerId)) goals.set(line.playerId, line.minutes.length);
  const rank = new Map(byRating.map((player, index) => [player.playerId, index]));
  const scorerIds = [...goals.entries()].sort((a, b) => b[1] - a[1] || (rank.get(a[0]) ?? 999) - (rank.get(b[0]) ?? 999)).map(([id]) => id);
  const preference: PreferredSubject = { teamId: team.id, playerId: facts.mvp && facts.mvp.side === side ? facts.mvp.playerId : null };
  if (scorerIds.length > 0) preference.scorerIds = scorerIds;
  if (byRating.length > 0) preference.rankedPlayerIds = byRating.map((player) => player.playerId);
  return preference;
}

/** Saf: tercih edilen konu ve fotoğrafı; tercih edilen takım arşivde yoksa null (seçici eski kuralına döner). */
export function preferredPickerDefault(data: ArchivePickerData, preferred: PreferredSubject): PickerDefault | null {
  const team = data.teams.find((entry) => entry.teamId === preferred.teamId);
  if (!team) return null;
  const kit = (key: string): PickerPhoto[] => (team.photos[key] ?? []).filter((photo) => photo.kitTeamId === preferred.teamId);
  const keepers = new Set(team.groups.filter((group) => group.group === "GK").flatMap((group) => group.subjects.map((subject) => subject.key)));
  const subjects = team.groups.flatMap((group) => group.subjects);
  const players = subjects.filter((subject) => subject.isPlayer);
  const teamKey = subjects.find((subject) => subject.key.startsWith("team:"))?.key ?? null;
  const keyOf = (personApiId: number | null) => (personApiId === null ? null : (players.find((subject) => subject.personApiId === personApiId)?.key ?? null));
  const outfield = players.filter((subject) => !keepers.has(subject.key));
  const rankIndex = new Map((preferred.rankedPlayerIds ?? []).map((id, index) => [id, index]));
  const ranked = [...outfield].sort((a, b) => (rankIndex.get(a.personApiId ?? -1) ?? 999) - (rankIndex.get(b.personApiId ?? -1) ?? 999));
  const mvpKey = keyOf(preferred.playerId);
  const thisMatch = (key: string) => kit(key).some((photo) => photo.bucket === "THIS_MATCH");

  // Saha tarafı aday sırası (kaleci hariç; MVP kaleci olsa bile MVP kuralı önce gelir).
  const main: string[] = [];
  const push = (key: string | null | undefined) => {
    if (key && !main.includes(key)) main.push(key);
  };
  push(mvpKey);
  for (const id of preferred.scorerIds ?? []) {
    const key = keyOf(id);
    if (key && !keepers.has(key)) push(key);
  }
  for (const subject of ranked) if (thisMatch(subject.key)) push(subject.key);
  for (const subject of ranked) push(subject.key);
  push(teamKey);
  const keeperOrder = players.filter((subject) => keepers.has(subject.key)).map((subject) => subject.key);

  const firstWith = (keys: readonly string[], accept: (photo: PickerPhoto) => boolean): PickerDefault | null => {
    for (const key of keys) {
      const photo = kit(key).find(accept);
      if (photo) return { subjectKey: key, photoId: photo.id };
    }
    return null;
  };
  const any = () => true;
  const ready = preferred.falAvailable === false ? (firstWith(main, isCardReady) ?? null) : null;
  const uploadKey = mvpKey ?? teamKey;
  return ready ?? firstWith(main, any) ?? (preferred.falAvailable === false ? firstWith(keeperOrder, isCardReady) : null) ?? firstWith(keeperOrder, any) ?? (uploadKey ? { subjectKey: uploadKey, photoId: null } : null);
}
