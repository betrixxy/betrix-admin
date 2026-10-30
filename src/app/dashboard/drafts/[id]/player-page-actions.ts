"use server";

import { z } from "zod";
import { getCurrentSession } from "@/lib/auth/require-session";
import { refreshDashboard, UNAUTHORIZED_MESSAGE } from "@/lib/dashboard/action-utils";
import { appendPlayerPage, draftPlayerSettlement } from "@/lib/dashboard/player-page-append";
import { startStudioJob } from "@/lib/jobs/studio-jobs";
import type { PlayerDataSettlement, PlayerPageAppendState } from "@/types/player-match-stats";
import type { Result } from "@/types/result";

const PAGES = { SPOTLIGHT: { template: "SPOTLIGHT", count: null }, TOP_3: { template: "TOP_PLAYERS", count: 3 }, TOP_5: { template: "TOP_PLAYERS", count: 5 } } as const;

const schema = z.object({
  draftId: z.string().min(1),
  page: z.enum(["SPOTLIGHT", "TOP_3", "TOP_5"], "Bir oyuncu sayfası seçin."),
  playerId: z.union([z.literal(""), z.coerce.number().int().positive()]).transform((value) => (value === "" ? null : value)),
  /** "Şimdi üret (veriler değişebilir)" onayı. */
  force: z.boolean(),
});

function text(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

/** Geri sayım için taslağın oyuncu verisi durumu (yalnızca okuma). */
export async function playerPageStatusAction(draftId: string): Promise<Result<PlayerDataSettlement>> {
  if (!(await getCurrentSession())) return { ok: false, error: { code: "UNAUTHORIZED", message: UNAUTHORIZED_MESSAGE } };
  return draftPlayerSettlement(z.string().min(1).parse(draftId));
}

/**
 * Taslağa oyuncu sayfasını sonradan ekle — ARKA PLAN İŞİ (A'nın arşiv fotoğrafı ilk kullanımda Fal ile
 * büyütülebilir). Aynı taslak için çalışan iş varsa ona bağlanılır.
 */
export async function appendPlayerPageAction(_prev: PlayerPageAppendState, formData: FormData): Promise<PlayerPageAppendState> {
  if (!(await getCurrentSession())) return { error: UNAUTHORIZED_MESSAGE };
  const parsed = schema.safeParse({ draftId: text(formData, "draftId"), page: text(formData, "page"), playerId: text(formData, "playerId"), force: formData.get("force") === "on" });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Geçersiz form verisi." };
  const { draftId, page, playerId, force } = parsed.data;
  const job = startStudioJob<PlayerPageAppendState>({
    kind: "player-page-append",
    key: `player-page-append:${draftId}`,
    firstStep: "Taslak okunuyor",
    run: async () => {
      const result = await appendPlayerPage(draftId, { ...PAGES[page], playerId }, force);
      if (!result.ok) return { error: result.error.message, ...(result.error.notSettled ? { notSettled: true } : {}) };
      try {
        refreshDashboard();
      } catch {
        // istek kapsamı kapanmış — sorun değil
      }
      return { done: true, notes: result.data.notes };
    },
    fail: (message) => ({ error: message }),
  });
  return { job };
}
