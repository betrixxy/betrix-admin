"use server";

import type { TemplateId, TournamentId } from "@/types/studio";

export interface GenerateMatchCardActionInput {
  templateId: TemplateId;
  tournamentId: TournamentId;
}

export interface GenerateMatchCardActionResult {
  success: boolean;
  message: string;
}

const MOCK_DELAY_MS = 3000;

/**
 * Maç kartı üretim akışının giriş noktası.
 *
 * MOCK: Şu an yalnızca mimari köprüyü kurar — `lib/services/fal` içindeki
 * `removePlayerBackground` / `generateStadiumBackground` fonksiyonlarını henüz
 * ÇAĞIRMAZ. Gerçek render orkestrasyonu (oyuncu görseli temizleme + stadyum
 * üretimi + 3 format katmanlama) sonraki fazda buraya eklenecek.
 */
export async function generateMatchCardAction(
  input: GenerateMatchCardActionInput,
): Promise<GenerateMatchCardActionResult> {
  await new Promise((resolve) => setTimeout(resolve, MOCK_DELAY_MS));

  return {
    success: true,
    message: `"${input.templateId}" şablonu için maç kartları üretildi (mock).`,
  };
}
