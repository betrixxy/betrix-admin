"use server";

import { z } from "zod";
import { getCurrentSession } from "@/lib/auth/require-session";
import { refreshDashboard, UNAUTHORIZED_MESSAGE } from "@/lib/dashboard/action-utils";
import { cancelReelProject, freezeReelSnapshot, saveReelAnalystNote, saveReelLineup, selectReelMatch } from "@/lib/reels/reel-engine";

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
  return { message: [`Sürüm ${result.data.version} donduruldu.`, ...result.data.squadWarnings, ...result.data.contextWarnings].join(" ") };
}

export async function saveReelAnalystNoteAction(_previous: ReelActionState, formData: FormData): Promise<ReelActionState> {
  if (!(await getCurrentSession())) return { error: UNAUTHORIZED_MESSAGE };
  const parsed = z.object({ projectId, screen: z.string().max(1000), voice: z.string().max(1000) }).safeParse({ projectId: formData.get("projectId"), screen: formData.get("screen") ?? "", voice: formData.get("voice") ?? "" });
  if (!parsed.success) return { error: "Geçersiz not." };
  const result = await saveReelAnalystNote(parsed.data.projectId, { screen: parsed.data.screen, voice: parsed.data.voice });
  if (!result.ok) return { error: result.error.message };
  refreshDashboard();
  return { message: "Not kaydedildi." };
}

const lineupForm = z.object({ projectId, side: z.enum(["home", "away"]), formation: z.string().max(20), reset: z.string().nullable() });

export async function saveReelLineupAction(_previous: ReelActionState, formData: FormData): Promise<ReelActionState> {
  if (!(await getCurrentSession())) return { error: UNAUTHORIZED_MESSAGE };
  const parsed = lineupForm.safeParse({ projectId: formData.get("projectId"), side: formData.get("side"), formation: formData.get("formation") ?? "", reset: formData.get("reset") });
  if (!parsed.success) return { error: "Geçersiz form." };
  const playerIds = Array.from({ length: 11 }, (_, slot) => {
    const value = Number.parseInt(String(formData.get(`slot${slot}`) ?? ""), 10);
    return Number.isInteger(value) && value > 0 ? value : null;
  });
  const result = await saveReelLineup(parsed.data.projectId, parsed.data.side, parsed.data.reset ? null : { formation: parsed.data.formation, playerIds });
  if (!result.ok) return { error: result.error.message };
  refreshDashboard();
  return { message: parsed.data.reset ? "Son maçın ilk 11'ine dönüldü." : "Muhtemel 11 kaydedildi." };
}
