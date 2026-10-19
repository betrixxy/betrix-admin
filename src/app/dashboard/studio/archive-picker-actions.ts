"use server";

import { z } from "zod";
import { loadPickerTeams } from "@/lib/archive/picker";
import { getCurrentSession } from "@/lib/auth/require-session";
import { UNAUTHORIZED_MESSAGE } from "@/lib/dashboard/action-utils";
import type { ArchivePickerData } from "@/types/archive";

const input = z.object({
  teamIds: z.array(z.number().int().positive()).min(1).max(2),
  fixtureId: z.string().regex(/^api-football-\d+$/).nullable(),
  /** Yalnızca forması o takımın olan fotoğraflar (vitrin posteri). */
  kitOnly: z.boolean(),
});

/**
 * Stüdyo arşiv seçicisinin verisi: maçtaki takım(lar)ın kişi listesi + fotoğrafları. Takım arşivde
 * yoksa ya da kadrosu hiç senkronlanmadıysa gerektikçe senkronlanır (yalnızca API okuması).
 */
export async function loadArchivePickerAction(teamIds: number[], fixtureId: string | null, kitOnly = false): Promise<ArchivePickerData> {
  if (!(await getCurrentSession())) return { teams: [], warnings: [], error: UNAUTHORIZED_MESSAGE };
  const parsed = input.safeParse({ teamIds, fixtureId, kitOnly });
  if (!parsed.success) return { teams: [], warnings: [], error: "Geçersiz takım/maç kimliği." };
  return loadPickerTeams(parsed.data.teamIds, parsed.data.fixtureId, { kitOnly: parsed.data.kitOnly });
}
