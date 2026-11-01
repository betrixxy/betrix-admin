"use server";

import { z } from "zod";
import { getCurrentSession } from "@/lib/auth/require-session";
import { refreshDashboard, UNAUTHORIZED_MESSAGE } from "@/lib/dashboard/action-utils";
import { cancelReelProject, freezeReelSnapshot, selectReelMatch } from "@/lib/reels/reel-engine";

/** Reels Stüdyo eylemleri: yalnızca admin tıklamasıyla; zamanlayıcıdan çağrılmaz (CLAUDE.md 1.10). */

export interface ReelActionState {
  error?: string | null;
  message?: string | null;
}

const matchId = z.coerce.number().int().positive();
const projectId = z.string().min(1).max(40);

export async function selectReelMatchAction(_previous: ReelActionState, formData: FormData): Promise<ReelActionState> {
  if (!(await getCurrentSession())) return { error: UNAUTHORIZED_MESSAGE };
  const parsed = matchId.safeParse(formData.get("matchId"));
  if (!parsed.success) return { error: "Geçersiz maç." };
  const result = await selectReelMatch(parsed.data);
  if (!result.ok) return { error: result.error.message };
  refreshDashboard();
  return { message: "Seçildi." };
}

export async function cancelReelProjectAction(_previous: ReelActionState, formData: FormData): Promise<ReelActionState> {
  if (!(await getCurrentSession())) return { error: UNAUTHORIZED_MESSAGE };
  const parsed = projectId.safeParse(formData.get("projectId"));
  if (!parsed.success) return { error: "Geçersiz proje." };
  const result = await cancelReelProject(parsed.data);
  if (!result.ok) return { error: result.error.message };
  refreshDashboard();
  return { message: "Seçim iptal edildi." };
}

export async function freezeReelSnapshotAction(_previous: ReelActionState, formData: FormData): Promise<ReelActionState> {
  if (!(await getCurrentSession())) return { error: UNAUTHORIZED_MESSAGE };
  const parsed = projectId.safeParse(formData.get("projectId"));
  if (!parsed.success) return { error: "Geçersiz proje." };
  const result = await freezeReelSnapshot(parsed.data);
  if (!result.ok) return { error: result.error.message };
  refreshDashboard();
  return { message: `Sürüm ${result.data.version} donduruldu.` };
}
