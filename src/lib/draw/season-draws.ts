import { drawCompetition, seasonText } from "@/lib/draw/rounds";
import type { DrawState } from "@/types/draw";

/**
 * Bitmiş kuralar için tek tık (saf): lig aşaması API fikstüründen yalnızca Türk takımlarının rakipleri,
 * iç saha / deplasman ve tarihler kalır; B (Temsilcilerimiz) ve A (takım odaklı) bununla doğrudan üretilir.
 * Canlı kura elle girilir (`entry.ts`) — bu yol yalnızca API'de fikstürü çıkmış kuralar için.
 */

export const isTurkishTeam = (team: { country: string | null }) => team.country === "Turkey";

/** Durumu Türk takımlarına daraltır: fikstürleri Türk takımınınkiler, katılımcıları onlar + rakipleri. Türk takımı yoksa null. */
export function turkishLeagueScope(state: DrawState): DrawState | null {
  const turkish = new Set(state.teams.filter(isTurkishTeam).map((team) => team.id));
  const fixtures = state.fixtures.filter((fixture) => turkish.has(fixture.teamId));
  if (fixtures.length === 0) return null;
  const involved = new Set(fixtures.flatMap((fixture) => [fixture.teamId, fixture.opponentId]));
  return { ...state, teams: state.teams.filter((team) => involved.has(team.id)), fixtures };
}

/** Stüdyo oturumu (sekme): tur kimliği + kura durumu. */
export interface DrawSessionLike {
  roundId: string;
  state: DrawState;
}

const MAX_SESSIONS = 3;
const hasEntries = (state: DrawState) => state.ties.length > 0 || state.fixtures.length > 0;

/**
 * API'den gelen lig aşaması kuraları stüdyo oturumlarına: gelenler başa, aynı turnuvanın lig aşaması
 * oturumu yenilenir; girişi olan diğer oturumlar korunur, boş yer tutucular atılır (en fazla 3).
 */
export function mergeSeasonDraws(sessions: readonly DrawSessionLike[], fetched: readonly DrawState[]): DrawSessionLike[] {
  const incoming = fetched.map((state) => ({ roundId: "LEAGUE", state }));
  const replaced = (s: DrawSessionLike) => s.roundId === "LEAGUE" && incoming.some((f) => f.state.competition.id === s.state.competition.id);
  const kept = sessions.filter((s) => hasEntries(s.state) && !replaced(s));
  return [...incoming, ...kept].slice(0, MAX_SESSIONS);
}

/** Sezonun Avrupa kuraları sonucu — ekranda tek satır özet. */
export function seasonDrawsSummary(found: DrawState[], skipped: string[]): string {
  const parts = found.map((state) => {
    const names = state.teams.filter(isTurkishTeam).length;
    return `${drawCompetition(state.competition.id)?.short ?? state.competition.name}: ${names} Türk takımı`;
  });
  const head = parts.length ? `Getirildi — ${parts.join(" · ")}.` : "Bu sezon için getirilecek lig aşaması kurası bulunamadı.";
  return skipped.length ? `${head} ${skipped.join(" ")}` : head;
}

/** `/leagues?id=&season=` özeti — katılımcı listesi boş geldiğinde nedenin kaynağı. */
export interface LeagueSeasonInfo {
  exists: boolean;
  current: boolean;
  start: string | null;
}

/**
 * "Katılımcıları API'den yükle" 0 takım döndürdüğünde ekranda yazılan neden. `info` null → lig bilgisi de
 * alınamadı (yalnızca boş liste bilinir).
 */
export function emptyParticipantsReason(competitionName: string, season: number, info: LeagueSeasonInfo | null, now = new Date()): string {
  const label = `${competitionName} ${seasonText(season)}`;
  if (info && !info.exists) return `API-Football'da ${label} sezonu yok — Sezon seçimini kontrol edin (Avrupa sezonu Temmuz'da başlar).`;
  if (info?.start && new Date(`${info.start}T00:00:00Z`) > now) return `${label} henüz başlamadı (API'de başlangıç ${info.start}); katılımcı listesi kuradan sonra dolar — elle ekleyin.`;
  return `API-Football ${label} için takım listesini boş döndürdü (hata yok). Katılımcıları elle ekleyin ya da kura bittiyse "Bu sezonun Avrupa kuralarını getir"i kullanın.`;
}
