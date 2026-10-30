import type { ApiFootballEventRaw, ApiFootballFixtureResultRaw } from "@/lib/services/api-football/types";

/**
 * Maçın oyuncu adı TEK kaynağı — (maç, oyuncu kimliği) başına bir API adı (saf, 2026-10-31). API-Football
 * olay akışı bazı oyuncuları resmi tam adla verir ("Samuel Mbangula Tshifunda"), aynı maçın oyuncu ve diziliş
 * blokları kısa adla ("S. Mbangula"). Olay adı kart adı kuralına (`cardPersonName`) girince Sportmonks kaydıyla
 * eşleşmiyor ("Tshifunda" yaygın adda yok) ve golcü satırı "S. TSHIFUNDA" çıkıyordu, oyuncu kartları
 * "S. MBANGULA". Kural: kimliği bilinen oyuncunun adı önce oyuncu bloğundan (`players`), sonra ilk 11'den
 * (`lineups.startXI`); ikisinde de yoksa olayın kendi adı. Golcü satırları (Maç Sonucu, İstatistik 02), Maç
 * Analizi zaman çizelgesi, MVP ve Oyuncu İstatistikleri böylece aynı API adından aynı kart adına iner.
 */

export function fixturePlayerNames(raw: Pick<ApiFootballFixtureResultRaw, "players" | "lineups">): Map<number, string> {
  const names = new Map<number, string>();
  for (const { players } of raw.players) {
    for (const { player } of players) if (player.name.trim() && !names.has(player.id)) names.set(player.id, player.name.trim());
  }
  for (const lineup of raw.lineups) {
    for (const { player } of lineup.startXI ?? []) if (typeof player.id === "number" && player.name.trim() && !names.has(player.id)) names.set(player.id, player.name.trim());
  }
  return names;
}

type EventPerson = ApiFootballEventRaw["player"];

const canonical = <T extends EventPerson | null | undefined>(person: T, names: ReadonlyMap<number, string>): T => {
  if (!person || typeof person.id !== "number") return person;
  const name = names.get(person.id);
  return name ? { ...person, name } : person;
};

/** Olay akışındaki oyuncu (golcü, kart, çıkan) ve asist/giren adları maçın tek adına çevrilir; kimliksiz olay olduğu gibi. */
export function withFixturePlayerNames<T extends Pick<ApiFootballFixtureResultRaw, "players" | "lineups" | "events">>(raw: T): T {
  const names = fixturePlayerNames(raw);
  if (names.size === 0) return raw;
  return { ...raw, events: raw.events.map((event) => ({ ...event, player: canonical(event.player, names), assist: canonical(event.assist, names) })) };
}
