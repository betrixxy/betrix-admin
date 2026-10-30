"use server";

import { z } from "zod";
import { getCurrentSession } from "@/lib/auth/require-session";
import { refreshDashboard, UNAUTHORIZED_MESSAGE } from "@/lib/dashboard/action-utils";
import { approveTeamColor } from "@/lib/dashboard/team-colors";
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

const colorSchema = z.object({ teamId: z.coerce.number().int().positive(), primary: z.string().regex(/^#[0-9a-fA-F]{6}$/u, "Renk #rrggbb olmalı."), secondary: z.string().regex(/^#[0-9a-fA-F]{6}$/u, "Renk #rrggbb olmalı.") });

/** Logodan otomatik çıkarılan takım rengini onayla (gerekirse düzelterek) — bundan sonra kulüp tablosu gibi kullanılır. */
export async function approveTeamColorAction(_prev: ArchiveActionState, formData: FormData): Promise<ArchiveActionState> {
  if (!(await getCurrentSession())) return { error: UNAUTHORIZED_MESSAGE };
  const parsed = colorSchema.safeParse({ teamId: formData.get("teamId"), primary: formData.get("primary"), secondary: formData.get("secondary") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Geçersiz renk." };
  if (!(await approveTeamColor(parsed.data.teamId, parsed.data.primary, parsed.data.secondary))) return { error: "Takım rengi kaydı bulunamadı." };
  refreshDashboard();
  return { notice: "Renk onaylandı." };
}
