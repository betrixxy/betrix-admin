import type { LineupSlot } from "@/types/lineup";

/**
 * Kahraman Liste kapağı kuralı (canlı prova 2026-11-01 — Beşiktaş kapağı Orkun Kökçü o 11'de değildi). Saf:
 * 1. Seçilen kapak fotoğrafındaki oyuncu kartın 11'indeyse o.
 * 2. Değilse (ya da seçim yoksa / takım fotoğrafı / teknik direktör) 11'de takımın kendi formalı arşiv fotoğrafı
 *    olan bir oyuncu — hücumdan geriye (11 sırası kaleciden forvete; kapak için öndeki oyuncu tercih edilir).
 * 3. O da yoksa kapaksız: ortak yedek tasarım (`templates/shared/team-fallback.tsx`).
 */

export interface HeroSelection {
  photoId: string;
  /** Fotoğraftaki kişinin API-Football kimliği (oyuncuysa); takım fotoğrafı / teknik direktörde null. */
  playerApiId: number | null;
  /** Kişinin okunur adı (not için); bilinmiyorsa null. */
  personName: string | null;
}

export type HeroPick =
  | { kind: "selected"; photoId: string; note: null }
  | { kind: "substitute"; photoId: string; playerId: number; note: string }
  | { kind: "fallback"; photoId: null; note: string };

/** 11'in oyuncu kimlikleri, kapak önceliğiyle (forvetten kaleciye). */
export function heroCandidateOrder(slots: Pick<LineupSlot, "playerId">[]): number[] {
  return [...slots].reverse().flatMap((slot) => (slot.playerId !== null ? [slot.playerId] : []));
}

export function pickLineupHero(input: {
  teamName: string;
  slots: Pick<LineupSlot, "playerId" | "name">[];
  selected: HeroSelection | null;
  /** Oyuncu kimliği → en yeni, takımın kendi formalı arşiv fotoğrafı (yalnızca 11'deki oyuncular için gerekir). */
  photoByPlayer: ReadonlyMap<number, string>;
}): HeroPick {
  const { teamName, slots, selected, photoByPlayer } = input;
  const inXi = new Set(slots.flatMap((slot) => (slot.playerId !== null ? [slot.playerId] : [])));
  if (selected && selected.playerApiId !== null && inXi.has(selected.playerApiId)) return { kind: "selected", photoId: selected.photoId, note: null };

  const reason = selected ? `${selected.personName ?? "Seçilen kapak"} bu 11'de değil` : "kapak seçilmedi";
  for (const playerId of heroCandidateOrder(slots)) {
    const photoId = photoByPlayer.get(playerId);
    if (!photoId) continue;
    const name = slots.find((slot) => slot.playerId === playerId)?.name.trim() || "11'deki bir oyuncu";
    return { kind: "substitute", photoId, playerId, note: `${teamName} kapağı: ${reason} — 11'den ${name} kullanıldı.` };
  }
  return { kind: "fallback", photoId: null, note: `${teamName} kapağı: ${selected ? `${reason}, ` : ""}11'de takım formalı fotoğrafı olan oyuncu yok — yedek tasarım.` };
}
