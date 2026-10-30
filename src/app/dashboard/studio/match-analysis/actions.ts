"use server";

import { z } from "zod";
import { getCurrentSession } from "@/lib/auth/require-session";
import { refreshDashboard, UNAUTHORIZED_MESSAGE } from "@/lib/dashboard/action-utils";
import { createMatchAnalysisDraft, loadStudioAnalysisFacts } from "@/lib/dashboard/match-analysis-engine";
import { validateMatchResultFixture } from "@/lib/dashboard/match-result-studio";
import { reportJobStep, startStudioJob } from "@/lib/jobs/studio-jobs";
import { getMatchResultRaw, parseFixtureId } from "@/lib/services/api-football";
import { MATCH_DAY_FORMAT_IDS } from "@/types/match-day";
import type { PostMatchCardActionState } from "@/types/post-match-cards";

const schema = z.object({
  fixtureId: z.string().regex(/^api-football-\d+$/, "Maç seçilmedi — Maç Merkezi'nden açın."),
  format: z.enum(MATCH_DAY_FORMAT_IDS, "Bir platform formatı seçin."),
});

function text(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

/**
 * "Maç Analizi" kartı: form → doğrulama → maç (sunucuda yeniden çekilir, yalnızca biten maç) → olaylar + devre
 * verisi + kart adları → 01 (+ 02) → DRAFT. ARKA PLAN İŞİ (iki çizim + iki sağlayıcı okuması 100 sn yanıt sınırına
 * yaklaşabilir); aynı maç + format için çalışan iş varsa ona bağlanılır.
 */
export async function generateMatchAnalysisAction(_prevState: PostMatchCardActionState, formData: FormData): Promise<PostMatchCardActionState> {
  if (!(await getCurrentSession())) return { error: UNAUTHORIZED_MESSAGE };
  const job = startStudioJob<PostMatchCardActionState>({
    kind: "match-analysis",
    key: `match-analysis:${text(formData, "fixtureId")}:${text(formData, "format")}`,
    firstStep: "Maç verisi alınıyor",
    run: () => runMatchAnalysis(formData),
    fail: (message) => ({ error: message }),
  });
  return { job };
}

async function runMatchAnalysis(formData: FormData): Promise<PostMatchCardActionState> {
  const parsed = schema.safeParse({ fixtureId: text(formData, "fixtureId"), format: text(formData, "format") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Geçersiz form verisi." };
  const apiId = parseFixtureId(parsed.data.fixtureId);
  const raw = apiId ? await getMatchResultRaw(apiId) : null;
  if (!raw?.ok) return { error: `Maç verisi alınamadı: ${raw?.error.message ?? "geçersiz maç kimliği"}` };
  const validated = validateMatchResultFixture(raw.data, new Date());
  if (!validated.ok || !raw.data) return { error: validated.ok ? "Maç bulunamadı." : validated.error.message };
  reportJobStep("Olaylar, devre verisi ve kişi adları");
  const facts = await loadStudioAnalysisFacts(raw.data);
  if (!facts) return { error: "Maç bitmemiş görünüyor — Maç Analizi üretilmedi." };
  const result = await createMatchAnalysisDraft({ facts, format: parsed.data.format });
  if (!result.ok) return { error: result.error.message };
  try {
    refreshDashboard();
  } catch {
    // istek kapsamı kapanmış — sorun değil
  }
  return { result: result.data };
}
