"use server";

import { z } from "zod";
import { getCurrentSession } from "@/lib/auth/require-session";
import { refreshDashboard, UNAUTHORIZED_MESSAGE } from "@/lib/dashboard/action-utils";
import { setVenueOverride } from "@/lib/names/venue-directory";
import type { ArchiveActionState } from "@/types/archive";

const venueSchema = z.object({ apiName: z.string().trim().min(1).max(120), displayName: z.string().max(80) });

/** Stadyum kart adı düzeltmesi; boş ad düzeltmeyi kaldırır. */
export async function setVenueNameAction(_prev: ArchiveActionState, formData: FormData): Promise<ArchiveActionState> {
  if (!(await getCurrentSession())) return { error: UNAUTHORIZED_MESSAGE };
  const parsed = venueSchema.safeParse({ apiName: formData.get("apiName"), displayName: formData.get("displayName") ?? "" });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Geçersiz stadyum adı." };
  await setVenueOverride(parsed.data.apiName, parsed.data.displayName);
  refreshDashboard();
  return { notice: parsed.data.displayName.trim() ? "Stadyum adı kaydedildi." : "Düzeltme kaldırıldı." };
}
