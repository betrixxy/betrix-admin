import { istanbulDay } from "@/lib/metrics/istanbul-time";
import type { Fixture } from "@/types/sports";

/**
 * Gün listesinin (`/fixtures?date=`) önbellek süresi — `fixtures.ts` yanıtı haritalayıp BU süreyle tutar:
 * - Geçmiş bir günün bütün maçları sonuçlandıysa (bitti / ertelendi / iptal) liste artık değişmez → 12 sa.
 * - Günde canlı maç varsa, başlama saati geçmiş ama henüz sonuçlanmamış maç varsa (devre arası, uzatma,
 *   penaltı, "FT" düşmemiş) ya da bir maç `LIVE_SOON_MS` içinde başlayacaksa → `LIVE_DAY_TTL_MS` (60 sn):
 *   Maç Merkezi'nin canlı dakikası donmasın (2026-10-30: "CANLI 85'" 14 dk aynı kaldı).
 * - Diğer günler → 15 dk.
 */
export const SETTLED_DAY_TTL_MS = 12 * 60 * 60 * 1000;
export const LIVE_DAY_TTL_MS = 60 * 1000;
export const DEFAULT_DAY_TTL_MS = 15 * 60 * 1000;
/** Bu kadar süre içinde başlayacak maç günü "canlıya yakın" sayar (15 dk önbellek başlamayı kaçırmasın). */
export const LIVE_SOON_MS = 15 * 60 * 1000;
/**
 * Başlama saatinden bu kadar sonra hâlâ "canlı"/"başlamadı" görünen maç sağlayıcıda takılı kalmış sayılır
 * (uzatma + penaltı + gecikme payı); geçmiş günü sonsuza dek 60 sn önbellekte tutmasın.
 */
export const STUCK_AFTER_MS = 4 * 60 * 60 * 1000;

const SETTLED_STATUS_CODES = new Set(["FT", "AET", "PEN", "PST", "CANC", "ABD", "AWD", "WO"]);
const NOT_STARTED_CODES = new Set(["NS", "TBD"]);

/** Saf: gün (İstanbul, YYYY-MM-DD) geçmişte mi ve tüm maçları sonuçlanmış mı. */
export function isSettledPastDay(date: string, fixtures: Fixture[], now: Date): boolean {
  return date < istanbulDay(now) && fixtures.every((fixture) => SETTLED_STATUS_CODES.has(fixture.progress?.statusShort ?? ""));
}

/** Saf: maç şu an canlı mı ya da canlıya yakın mı (başlamak üzere / başlama saati geçmiş ama sonuçlanmamış). */
export function isLiveOrNear(fixture: Pick<Fixture, "kickoffUtc" | "progress">, now: Date): boolean {
  const short = fixture.progress?.statusShort ?? "";
  if (SETTLED_STATUS_CODES.has(short)) return false;
  const kickoff = Date.parse(fixture.kickoffUtc);
  if (!Number.isFinite(kickoff)) return false;
  const untilKickoff = kickoff - now.getTime();
  if (untilKickoff < -STUCK_AFTER_MS) return false;
  // Başlamamış ("NS") maç: başlamasına az kaldıysa ya da saati geçtiyse (gecikmeli başlama).
  if (NOT_STARTED_CODES.has(short) || short === "") return untilKickoff <= LIVE_SOON_MS;
  // Canlı (1H/HT/2H/ET/BT/P/LIVE) ya da askıda (SUSP/INT): kısa önbellek.
  return true;
}

/** Saf: gün listesinin önbellek süresi (ms). */
export function dayCacheTtlMs(date: string, fixtures: Fixture[], now: Date): number {
  if (isSettledPastDay(date, fixtures, now)) return SETTLED_DAY_TTL_MS;
  if (fixtures.some((fixture) => isLiveOrNear(fixture, now))) return LIVE_DAY_TTL_MS;
  return DEFAULT_DAY_TTL_MS;
}
