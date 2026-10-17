"use server";

import { z } from "zod";
import { getCurrentSession } from "@/lib/auth/require-session";
import { refreshDashboard, UNAUTHORIZED_MESSAGE } from "@/lib/dashboard/action-utils";
import { unwatchFixture, watchFixture } from "@/lib/dashboard/watched-fixtures";
import { getFixtureById, parseFixtureId } from "@/lib/services/api-football";

const toggleSchema = z.object({
  fixtureId: z.string().regex(/^api-football-\d+$/, "Geçersiz maç kimliği."),
  starred: z.boolean(),
});

export type ToggleWatchResult = { ok: true; starred: boolean } | { ok: false; error: string };

/**
 * Maç satırındaki yıldız (☆/★). Yıldızlarken maç sağlayıcıdan yeniden çekilir ve anlık görüntü
 * sunucuda yazılır; kaldırırken yalnızca takip kaydı silinir (içerikler ve planlar kalır).
 */
export async function toggleWatchAction(input: { fixtureId: string; starred: boolean }): Promise<ToggleWatchResult> {
  if (!(await getCurrentSession())) return { ok: false, error: UNAUTHORIZED_MESSAGE };
  const parsed = toggleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Geçersiz istek." };
  const { fixtureId, starred } = parsed.data;

  try {
    if (starred) {
      const apiId = parseFixtureId(fixtureId);
      const fixture = apiId ? await getFixtureById(apiId) : null;
      if (!fixture?.ok) return { ok: false, error: `Maç bilgisi alınamadı: ${fixture?.error.message ?? "geçersiz kimlik"}` };
      await watchFixture(fixture.data);
    } else {
      await unwatchFixture(fixtureId);
    }
  } catch {
    return { ok: false, error: "Yıldız kaydedilemedi — veritabanına yazılamadı." };
  }
  refreshDashboard();
  return { ok: true, starred };
}
