"use server";

import { z } from "zod";
import { getCurrentSession } from "@/lib/auth/require-session";
import { refreshDashboard, UNAUTHORIZED_MESSAGE } from "@/lib/dashboard/action-utils";
import { writeFixtureOutcomes } from "@/lib/dashboard/prediction-scorecard-data";
import { createMatchScorecardDraft, createPeriodScorecardDraft, loadScorecardMatch } from "@/lib/dashboard/prediction-scorecard-engine";
import { reportJobStep, startStudioJob } from "@/lib/jobs/studio-jobs";
import { MATCH_DAY_FORMAT_IDS } from "@/types/match-day";
import type { PostMatchCardActionState, SettleActionState } from "@/types/post-match-cards";
import { PERIOD_KINDS } from "@/types/prediction-scorecard";

/**
 * Tahmin Karnesi stüdyosu: "Sonuçları hesapla" (A — maçın skorunu okuyup `PredictionOutcome`'a YALNIZCA EKLER;
 * veritabanına yazan TEK yol, yalnızca admin tıklamasıyla — zamanlayıcı yok) ve iki kart üretimi (A maç, B dönem).
 * Hepsi arka plan işi; oturum burada doğrulanır.
 */

const fixtureId = z.string().regex(/^api-football-\d+$/, "Maç seçilmedi — Maç Merkezi'nden açın.");
const format = z.enum(MATCH_DAY_FORMAT_IDS, "Bir platform formatı seçin.");
const periodSchema = z.object({
  kind: z.enum(PERIOD_KINDS, "Bir dönem seçin."),
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Geçerli bir gün seçin."),
  splitByModelVersion: z.boolean(),
  format,
});

function text(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function refresh(): void {
  try {
    refreshDashboard();
  } catch {
    // istek kapsamı kapanmış — sorun değil
  }
}

export async function settleScorecardAction(_prevState: SettleActionState, formData: FormData): Promise<SettleActionState> {
  if (!(await getCurrentSession())) return { error: UNAUTHORIZED_MESSAGE };
  const id = text(formData, "fixtureId");
  const job = startStudioJob<SettleActionState>({
    kind: "scorecard-settle",
    key: `scorecard-settle:${id}`,
    firstStep: "Maç skoru alınıyor",
    run: async () => {
      const parsed = fixtureId.safeParse(id);
      if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Geçersiz maç." };
      const match = await loadScorecardMatch(parsed.data);
      if (!match.ok) return { error: match.error.message };
      reportJobStep("Sonuçlar yazılıyor");
      const summary = await writeFixtureOutcomes(match.data);
      refresh();
      return { summary };
    },
    fail: (message) => ({ error: message }),
  });
  return { job };
}

export async function generateMatchScorecardAction(_prevState: PostMatchCardActionState, formData: FormData): Promise<PostMatchCardActionState> {
  if (!(await getCurrentSession())) return { error: UNAUTHORIZED_MESSAGE };
  const job = startStudioJob<PostMatchCardActionState>({
    kind: "scorecard-match",
    key: `scorecard-match:${text(formData, "fixtureId")}:${text(formData, "format")}`,
    firstStep: "Maç skoru alınıyor",
    run: async () => {
      const parsed = z.object({ fixtureId, format }).safeParse({ fixtureId: text(formData, "fixtureId"), format: text(formData, "format") });
      if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Geçersiz form verisi." };
      const result = await createMatchScorecardDraft(parsed.data);
      if (!result.ok) return { error: result.error.message };
      refresh();
      return { result: result.data };
    },
    fail: (message) => ({ error: message }),
  });
  return { job };
}

export async function generatePeriodScorecardAction(_prevState: PostMatchCardActionState, formData: FormData): Promise<PostMatchCardActionState> {
  if (!(await getCurrentSession())) return { error: UNAUTHORIZED_MESSAGE };
  const key = ["kind", "day", "splitByModelVersion", "format"].map((name) => text(formData, name)).join(":");
  const job = startStudioJob<PostMatchCardActionState>({
    kind: "scorecard-period",
    key: `scorecard-period:${key}`,
    firstStep: "Dönemin tahmin kayıtları",
    run: async () => {
      const parsed = periodSchema.safeParse({ kind: text(formData, "kind"), day: text(formData, "day"), splitByModelVersion: formData.get("splitByModelVersion") === "on", format: text(formData, "format") });
      if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Geçersiz form verisi." };
      const result = await createPeriodScorecardDraft(parsed.data);
      if (!result.ok) return { error: result.error.message };
      refresh();
      return { result: result.data };
    },
    fail: (message) => ({ error: message }),
  });
  return { job };
}
