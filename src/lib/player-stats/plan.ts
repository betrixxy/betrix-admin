import type { PlayerDataSettlement } from "@/types/player-match-stats";

/**
 * Oyuncu sayfası (03) seti KİLİTLEMEZ (kurucu kararı 2026-10-30) — saf karar:
 *   - Veri kesinleştiyse sayfa şimdi çizilir.
 *   - Kesinleşmediyse varsayılan "hazır olunca ekle": 01 + 02 hemen üretilir, 03 taslağa BEKLEYEN olarak yazılır;
 *     sonradan (yayından önce) taslak ekranından arka plan işiyle eklenir.
 *   - "Şimdi üret (veriler değişebilir)": kesinleşmeden çizilir, kayıt ve notlar "geçici" diye işaretlenir.
 */

export const PLAYER_PAGE_MODES = ["WHEN_READY", "NOW"] as const;
export type PlayerPageMode = (typeof PLAYER_PAGE_MODES)[number];

export type PlayerPagePlan =
  | { action: "NONE" }
  | { action: "RENDER"; provisional: boolean }
  | { action: "DEFER"; reason: string; readyAt: string | null };

export const PROVISIONAL_NOTE = "Oyuncu verisi kesinleşmeden üretildi — puan ve istatistikler değişebilir; yayından önce sayfayı yeniden ekleyin.";

export function playerPagePlan(requested: boolean, settlement: PlayerDataSettlement | null, mode: PlayerPageMode): PlayerPagePlan {
  if (!requested || !settlement) return { action: "NONE" };
  if (settlement.settled) return { action: "RENDER", provisional: false };
  return mode === "NOW" ? { action: "RENDER", provisional: true } : { action: "DEFER", reason: settlement.reason, readyAt: settlement.readyAt };
}

/** Taslağa sonradan eklenecek sayfanın kaydı (`renderOptions.pendingPlayerPage`). */
export interface PendingPlayerPage {
  template: "SPOTLIGHT" | "TOP_PLAYERS";
  count: 3 | 5 | null;
  /** A: gönderi metnindeki maçın oyuncusu. */
  playerId: number | null;
}
