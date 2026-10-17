"use server";

import { getCurrentSession } from "@/lib/auth/require-session";
import { UNAUTHORIZED_MESSAGE } from "@/lib/dashboard/action-utils";
import { getPlanPage, parsePlanCursor, type PlanPage } from "@/lib/dashboard/plan-data";

export type LoadPlanPageResult = { ok: true; page: PlanPage } | { ok: false; error: string };

/** İçerik Planı'nın sonraki 7 günü (aşağı kaydırınca). Yalnızca okuma. */
export async function loadPlanPageAction(cursor: string): Promise<LoadPlanPageResult> {
  if (!(await getCurrentSession())) return { ok: false, error: UNAUTHORIZED_MESSAGE };
  const now = new Date();
  const day = parsePlanCursor(cursor, now);
  if (!day) return { ok: false, error: "Geçersiz sayfa imleci." };
  try {
    return { ok: true, page: await getPlanPage(day, now) };
  } catch {
    return { ok: false, error: "Plan yüklenemedi — veritabanına ulaşılamadı." };
  }
}
