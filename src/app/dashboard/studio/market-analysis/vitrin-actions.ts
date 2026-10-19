"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { resolveArchivePhoto } from "@/lib/archive/picker-input";
import { getCurrentSession } from "@/lib/auth/require-session";
import { refreshDashboard, UNAUTHORIZED_MESSAGE } from "@/lib/dashboard/action-utils";
import { createVitrinDraft, predictWithRuleReasons, renderVitrin, vitrinMeta, vitrinPrediction } from "@/lib/dashboard/vitrin-engine";
import { auditReasons, matchSides, vitrinFacts } from "@/lib/prediction/reasons";
import { openBoxLines, scenarioTitle } from "@/lib/prediction/catalog";
import { isAnthropicConfigured } from "@/lib/services/anthropic";
import { generateScenarioReasons } from "@/lib/services/anthropic/scenario-reasons";
import { getDeepAnalysisStats, parseFixtureId } from "@/lib/services/api-football";
import type { DeepAnalysisStats } from "@/types/deep-analysis";
import { MATCH_DAY_FORMAT_IDS } from "@/types/match-day";
import { REASON_MAX_LENGTH, SCENARIO_IDS, type ScenarioId } from "@/types/prediction";
import type { Result } from "@/types/result";

/**
 * Maç önü vitrin stüdyosu. Tahmin (yüzdeler) her çağrıda SUNUCUDA veriden hesaplanır; istemciden
 * yalnızca gerekçeler ve kutu seçimi gelir. AI analist yalnızca admin tıklamasıyla çağrılır.
 */

export interface VitrinScenarioRow {
  id: ScenarioId;
  title: string;
  /** "Galatasaray %56 · Beraberlik %23 · Kasımpaşa %20" ya da "Evet %64" */
  summary: string;
  reason: string;
  issues: string[];
}

export interface VitrinLoadResult {
  fixtureId: string;
  title: string;
  homeTeamId: number;
  awayTeamId: number;
  homeName: string;
  awayName: string;
  scenarioCount: number;
  surprisePct: number;
  rows: VitrinScenarioRow[];
  analystAvailable: boolean;
}

type Fail = { ok: false; error: { code: string; message: string } };
const fail = (code: string, message: string): Fail => ({ ok: false, error: { code, message } });

async function loadStats(fixtureId: string): Promise<Result<DeepAnalysisStats>> {
  if (!(await getCurrentSession())) return fail("UNAUTHORIZED", UNAUTHORIZED_MESSAGE);
  const apiId = parseFixtureId(fixtureId);
  if (apiId === null) return fail("INVALID_INPUT", "Geçersiz maç.");
  const stats = await getDeepAnalysisStats(apiId);
  return stats.ok ? stats : fail(stats.error.code, stats.error.message);
}

/** Tahmin + gerekçeler (verilmezse kural tabanlı) → stüdyo tablosu, denetim sonuçlarıyla. */
async function buildRows(fixtureId: string, stats: DeepAnalysisStats, reasons: Partial<Record<ScenarioId, string>>): Promise<Result<VitrinLoadResult>> {
  const base = await predictWithRuleReasons(stats);
  if (!base.ok) return base;
  const sides = matchSides(stats);
  const scenarios = base.data.scenarios.map((scenario) => ({ ...scenario, reason: reasons[scenario.id] ?? scenario.reason }));
  const audits = auditReasons(scenarios, vitrinFacts(stats), sides);
  const meta = vitrinMeta(stats);
  return {
    ok: true,
    data: {
      fixtureId,
      title: `${sides.home} – ${sides.away}`,
      homeTeamId: meta.homeTeamId,
      awayTeamId: meta.awayTeamId,
      homeName: sides.home,
      awayName: sides.away,
      scenarioCount: base.data.scenarioCount,
      surprisePct: base.data.surprisePct,
      analystAvailable: isAnthropicConfigured(),
      rows: scenarios.map((scenario) => ({
        id: scenario.id,
        title: scenarioTitle(scenario.id, sides, scenario.outcome),
        summary: openBoxLines(scenario, sides).map((line) => `${line.label} ${line.value}`).join(" · "),
        reason: scenario.reason,
        issues: audits[scenario.id] ?? [],
      })),
    },
  };
}

export async function loadVitrinAction(fixtureId: string): Promise<Result<VitrinLoadResult>> {
  const stats = await loadStats(fixtureId);
  return stats.ok ? buildRows(fixtureId, stats.data, {}) : stats;
}

/** Çelik Kasa analisti altı gerekçeyi yazar (tek çağrı); denetim sonuçları tabloya döner. */
export async function writeReasonsAction(fixtureId: string): Promise<Result<VitrinLoadResult>> {
  const stats = await loadStats(fixtureId);
  if (!stats.ok) return stats;
  const base = await predictWithRuleReasons(stats.data);
  if (!base.ok) return base;
  const sides = matchSides(stats.data);
  const picks = base.data.scenarios.map((scenario) => ({ senaryo: scenarioTitle(scenario.id, sides, scenario.outcome), kimlik: scenario.id, secili_sonuc: openBoxLines(scenario, sides).find((line) => line.picked)?.label ?? "" }));
  const written = await generateScenarioReasons(vitrinFacts(stats.data), picks);
  if (!written.ok) return fail(written.error.code, written.error.message);
  return buildRows(fixtureId, stats.data, written.data);
}

const reasonsSchema = z.record(z.enum(SCENARIO_IDS), z.string().max(REASON_MAX_LENGTH * 2));
const requestSchema = z.object({
  fixtureId: z.string().regex(/^api-football-\d+$/),
  format: z.enum(MATCH_DAY_FORMAT_IDS),
  open: z.tuple([z.enum(SCENARIO_IDS), z.enum(SCENARIO_IDS)]),
  locked: z.tuple([z.enum(SCENARIO_IDS), z.enum(SCENARIO_IDS), z.enum(SCENARIO_IDS)]),
  reasons: reasonsSchema,
});

function readRequest(formData: FormData) {
  const json = (name: string) => {
    try {
      return JSON.parse(String(formData.get(name) ?? "null")) as unknown;
    } catch {
      return null;
    }
  };
  return requestSchema.safeParse({ fixtureId: formData.get("fixtureId"), format: formData.get("format"), open: json("open"), locked: json("locked"), reasons: json("reasons") });
}

/** Posterin iki tarafı: ev sahibi fotoğrafı yalnızca ev sahibinden, deplasmanınki yalnızca deplasmandan. */
const PHOTO_FIELDS = { home: "photoHome", away: "photoAway" } as const;

async function resolvePhotos(formData: FormData, meta: ReturnType<typeof vitrinMeta>, fixtureId: string) {
  const [home, away] = await Promise.all([
    resolveArchivePhoto(formData, PHOTO_FIELDS.home, [meta.homeTeamId], fixtureId),
    resolveArchivePhoto(formData, PHOTO_FIELDS.away, [meta.awayTeamId], fixtureId),
  ]);
  if (!home.ok) return home;
  if (!away.ok) return away;
  return { ok: true as const, data: { home: home.data, away: away.data } };
}

/** Önizleme: kaydetmez, arşive yazmaz — yalnızca arşivden SEÇİLEN fotoğrafları kullanır (yeni yükleme kayıtta girer). */
export async function previewVitrinAction(formData: FormData): Promise<Result<{ dataUrls: [string, string] }>> {
  const parsed = readRequest(formData);
  if (!parsed.success) return fail("INVALID_INPUT", parsed.error.issues[0]?.message ?? "Form geçersiz.");
  const stats = await loadStats(parsed.data.fixtureId);
  if (!stats.ok) return stats;
  const selection = { open: parsed.data.open, locked: parsed.data.locked };
  const prediction = await vitrinPrediction(stats.data, parsed.data.reasons, selection);
  if (!prediction.ok) return prediction;
  const meta = vitrinMeta(stats.data);
  const preview = new FormData();
  for (const field of Object.values(PHOTO_FIELDS)) {
    const photoId = formData.get(`${field}PhotoId`);
    if (typeof photoId === "string" && photoId) preview.set(`${field}PhotoId`, photoId);
  }
  const photos = await resolvePhotos(preview, meta, parsed.data.fixtureId);
  if (!photos.ok) return photos;
  const rendered = await renderVitrin({ stats: stats.data, prediction: prediction.data, selection, format: parsed.data.format, photos: { home: photos.data.home?.image ?? null, away: photos.data.away?.image ?? null } });
  if (!rendered.ok) return rendered;
  const [poster, analysis] = rendered.data.pages.map((png) => `data:image/png;base64,${png.toString("base64")}`);
  return { ok: true, data: { dataUrls: [poster ?? "", analysis ?? ""] } };
}

/** Kaydet: carousel'i çizer, DRAFT açar, inceleme ekranına yönlendirir. Yeni fotoğraflar arşive (doğru klasöre) girer. */
export async function saveVitrinAction(formData: FormData): Promise<Result<never>> {
  const parsed = readRequest(formData);
  if (!parsed.success) return fail("INVALID_INPUT", parsed.error.issues[0]?.message ?? "Form geçersiz.");
  const stats = await loadStats(parsed.data.fixtureId);
  if (!stats.ok) return stats;
  const selection = { open: parsed.data.open, locked: parsed.data.locked };
  const prediction = await vitrinPrediction(stats.data, parsed.data.reasons, selection);
  if (!prediction.ok) return prediction;
  const meta = vitrinMeta(stats.data);
  const photos = await resolvePhotos(formData, meta, parsed.data.fixtureId);
  if (!photos.ok) return photos;
  const saved = await createVitrinDraft({
    fixtureId: parsed.data.fixtureId,
    stats: stats.data,
    prediction: prediction.data,
    selection,
    format: parsed.data.format,
    photos: { home: photos.data.home?.image ?? null, away: photos.data.away?.image ?? null },
    photoIds: { home: photos.data.home?.photoId ?? null, away: photos.data.away?.photoId ?? null },
  });
  if (!saved.ok) return saved;
  refreshDashboard();
  redirect(`/dashboard/drafts/${saved.data.id}`);
}
