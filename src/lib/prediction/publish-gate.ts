import type { Fixture } from "@/types/sports";
import { kickoffGate } from "./kickoff";

/**
 * Vitrin yayın kapısı (kurucu kararı, 2026-10-20) — saf. VITRIN türündeki bir taslak yalnızca onay
 * akışından geçmişse yayınlanır: durum APPROVED, açık kutuların tahmin kaydı (PredictionRecord) yazılmış
 * ve yayın anı kickoff'tan önce. Hemen Paylaş (platform çağrısından ÖNCE) ve yayın kaydı
 * (`markDraftPublished`) aynı kuralı okur. Kayıt yoksa yayın reddedilir.
 */

export interface VitrinPublishState {
  status: string;
  /** Bu taslağa ait PredictionRecord satırı sayısı. */
  recordCount: number;
  /** Onayda yazılması gereken satır sayısı (açık kutular). */
  requiredRecords: number;
  /** Kickoff doğrulanamadıysa null. */
  fixture: Pick<Fixture, "kickoffUtc" | "status"> | null;
}

/** Yayınlanabilirse null, değilse okunur sebep. */
export function vitrinPublishGate(state: VitrinPublishState, at: Date): string | null {
  if (state.status !== "APPROVED") return "Vitrin onay akışından geçmeden yayınlanamaz — önce taslağı onaylayın (tahmin kaydı onayda yazılır).";
  if (state.recordCount < state.requiredRecords) return `Vitrinin tahmin kaydı eksik (${state.recordCount}/${state.requiredRecords}) — yayın reddedildi.`;
  if (!state.fixture) return "Maçın başlama saati doğrulanamadı — yayın reddedildi.";
  const late = kickoffGate(state.fixture, at);
  return late ? `${late} Yayın reddedildi.` : null;
}
