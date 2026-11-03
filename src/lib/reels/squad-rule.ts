/**
 * Kadro doğruluğu kuralı (saf). Videodaki her oyuncu–takım eşleşmesi güncel kadrodan doğrulanır; kaynak API-Football,
 * checkmatch'in oyuncu/kadro verisi kullanılmaz. Proje seçiminde ve veri dondurmada yenilenir, önbellek en fazla 7 gün.
 * Video tarafı aynı kuralı `reels-video/src/story/squad.ts` ile uygular.
 */

export const REEL_SQUAD_MAX_AGE_DAYS = 7;
const DAY_MS = 86_400_000;

export interface ReelSquadPlayer {
  id: number;
  name: string;
}

export interface ReelSquadEntry {
  players: ReelSquadPlayer[];
  checkedAt: Date;
}

export const isReelSquadFresh = (checkedAt: Date, now: Date): boolean => now.getTime() - checkedAt.getTime() <= REEL_SQUAD_MAX_AGE_DAYS * DAY_MS;

export interface ReelSquadResult {
  /** İki takımın da taze kadrosu varsa en eski kontrol zamanı; yoksa null: oyuncu sahneleri kapalı. */
  checkedAt: Date | null;
  /** Panelde gösterilen uyarılar. */
  warnings: string[];
}

export interface ReelSquadDeps {
  fetchSquad: (teamId: number) => Promise<{ ok: true; data: ReelSquadPlayer[] } | { ok: false; message: string }>;
  readStored: (teamId: number) => Promise<ReelSquadEntry | null>;
  store: (teamId: number, entry: ReelSquadEntry) => Promise<void>;
}

/**
 * Kaynak yenilenir; kaynak hata verirse ya da boş kadro dönerse 7 günden yeni kayıt kullanılır. O da yoksa takım doğrulanamaz.
 * Dondurma bu yüzden durmaz: yalnız oyuncu sahneleri kapalı kalır.
 */
export async function refreshReelSquads(teams: readonly { id: number; name: string }[], deps: ReelSquadDeps, now: Date = new Date()): Promise<ReelSquadResult> {
  const results = await Promise.all(teams.map(async (team): Promise<{ checkedAt: Date | null; warning: string | null }> => {
    const fetched = await deps.fetchSquad(team.id);
    if (fetched.ok && fetched.data.length > 0) {
      await deps.store(team.id, { players: fetched.data, checkedAt: now });
      return { checkedAt: now, warning: null };
    }
    const reason = fetched.ok ? "kaynak boş kadro döndürdü" : fetched.message;
    const stored = await deps.readStored(team.id);
    if (stored && isReelSquadFresh(stored.checkedAt, now)) return { checkedAt: stored.checkedAt, warning: `${team.name}: kadro yenilenemedi (${reason}), son kayıt kullanıldı.` };
    return { checkedAt: null, warning: `${team.name}: kadro doğrulanamadı (${reason}). Oyuncu sahneleri kapalı.` };
  }));
  const dates = results.map((result) => result.checkedAt);
  const known = dates.filter((date): date is Date => date !== null);
  return {
    checkedAt: known.length === dates.length && known.length > 0 ? new Date(Math.min(...known.map((date) => date.getTime()))) : null,
    warnings: results.flatMap((result) => (result.warning ? [result.warning] : [])),
  };
}

/** Oyuncu bu takımın doğrulanmış kadrosunda mı. Eşleşme kimlikle; ad değişse de, adaş olsa da yanılmaz. */
export const isInReelSquad = (entry: ReelSquadEntry | null, playerId: number, now: Date): boolean =>
  entry !== null && isReelSquadFresh(entry.checkedAt, now) && entry.players.some((player) => player.id === playerId);

/** Panel satırı. */
export function reelSquadStatus(checkedAt: Date | null, now: Date, format: (date: Date) => string): { ok: boolean; text: string } {
  if (checkedAt === null) return { ok: false, text: "Kadro doğrulanamadı: oyuncu sahneleri kapalı" };
  if (!isReelSquadFresh(checkedAt, now)) return { ok: false, text: `Kadro doğrulaması ${REEL_SQUAD_MAX_AGE_DAYS} günden eski (${format(checkedAt)}): yeniden dondurun` };
  return { ok: true, text: `Kadro doğrulandı: ${format(checkedAt)}` };
}
