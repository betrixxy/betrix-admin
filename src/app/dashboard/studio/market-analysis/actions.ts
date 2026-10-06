"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentSession } from "@/lib/auth/require-session";
import { UNAUTHORIZED_MESSAGE } from "@/lib/dashboard/action-utils";
import { buildMarketAnalysisDraft, suggestMarkets } from "@/lib/dashboard/deep-analysis-insights";
import { createExpertAnalysisDraft, type ExpertAnalysisResult } from "@/lib/dashboard/expert-analysis";
import { renderDeepAnalysisCard } from "@/lib/dashboard/deep-analysis-render";
import { createMarketAnalysisDraft } from "@/lib/dashboard/market-analysis-engine";
import { createAnalysisHero, type AnalysisHeroResult } from "@/lib/dashboard/analysis-hero";
import { resolveStudioImage } from "@/lib/dashboard/studio-image-input";
import { isFalConfigured } from "@/lib/services/fal";
import { getDeepAnalysisStats, getFixtureById, parseFixtureId } from "@/lib/services/api-football";
import {
  ANALYSIS_POINT_COUNT,
  HERO_FILE_PATTERN,
  HERO_QUALITIES,
  KEY_PLAYER_COUNT,
  STAT_TILE_COUNT,
  type MarketAnalysisDraft,
  type MarketSuggestion,
  type TeamDeepStats,
} from "@/types/deep-analysis";
import type { Result } from "@/types/result";

/** Formun yanında gösterilen ham veri özeti — admin önerilerin neye dayandığını görür. */
export interface TeamDataSummary {
  teamName: string;
  last5: string[];
  matchesSampled: number;
  statMatchesSampled: number;
  formation: string | null;
  goalsForAvg: number | null;
  goalsAgainstAvg: number | null;
  xgForAvg: number | null;
  xgAgainstAvg: number | null;
}

export interface DeepAnalysisLoadResult {
  draft: MarketAnalysisDraft;
  suggestions: MarketSuggestion[];
  home: TeamDataSummary;
  away: TeamDataSummary;
  fetchedAtUtc: string;
}

function summarize(team: TeamDeepStats): TeamDataSummary {
  const { form } = team;
  return {
    teamName: form.teamName,
    last5: form.last5,
    matchesSampled: form.matchesSampled,
    statMatchesSampled: team.statMatchesSampled,
    formation: team.formation,
    goalsForAvg: form.goalsForAvg,
    goalsAgainstAvg: form.goalsAgainstAvg,
    xgForAvg: form.xgForAvg,
    xgAgainstAvg: form.xgAgainstAvg,
  };
}

/** Seçilen maçın derin analiz verisini çeker ve formu kural tabanlı önerilerle doldurur. */
export async function loadDeepAnalysisAction(fixtureId: string): Promise<Result<DeepAnalysisLoadResult>> {
  if (!(await getCurrentSession())) {
    return { ok: false, error: { code: "UNAUTHORIZED", message: UNAUTHORIZED_MESSAGE } };
  }
  const apiId = parseFixtureId(fixtureId);
  if (apiId === null) return { ok: false, error: { code: "INVALID_INPUT", message: "Geçersiz maç." } };

  const stats = await getDeepAnalysisStats(apiId);
  if (!stats.ok) return { ok: false, error: { code: stats.error.code, message: stats.error.message } };

  return {
    ok: true,
    data: {
      draft: buildMarketAnalysisDraft(fixtureId, stats.data),
      suggestions: suggestMarkets(stats.data),
      home: summarize(stats.data.home),
      away: summarize(stats.data.away),
      fetchedAtUtc: stats.data.fetchedAtUtc,
    },
  };
}

const text = (max: number) => z.string().trim().max(max);
const teamDraftSchema = z.object({
  teamName: text(60).min(1, "Takım adı boş olamaz."),
  logoUrl: text(500),
  colorHex: z.string().regex(/^(#[0-9a-fA-F]{6})?$/, "Takım rengi #RRGGBB olmalı."),
  heroImageUrl: z.string().refine((value) => value === "" || HERO_FILE_PATTERN.test(value), "Kapak görseli geçersiz."),
  strengths: z.array(text(120)).length(ANALYSIS_POINT_COUNT),
  cautions: z.array(text(120)).length(ANALYSIS_POINT_COUNT),
  keyPlayers: z.array(z.object({ name: text(40), role: text(60), photoUrl: text(500) })).length(KEY_PLAYER_COUNT),
  stats: z.array(z.object({ label: text(24), value: text(10) })).length(STAT_TILE_COUNT),
  approach: text(400),
  quote: text(240),
});
const previewSchema = z.object({ team: teamDraftSchema, opponentName: text(60) });
const saveSchema = z.object({
  fixtureId: z.string(),
  home: teamDraftSchema,
  away: teamDraftSchema,
  marketPick: text(40),
  marketRationale: text(160),
});

function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Form alanları geçersiz.";
}

/** Tek takımın analiz kartını PNG olarak çizer — Fal.ai'ye gidilmez, kaydedilmez (yalnızca önizleme). */
export async function previewDeepAnalysisAction(input: unknown): Promise<Result<{ dataUrl: string }>> {
  if (!(await getCurrentSession())) {
    return { ok: false, error: { code: "UNAUTHORIZED", message: UNAUTHORIZED_MESSAGE } };
  }
  const parsed = previewSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: { code: "INVALID_INPUT", message: firstIssue(parsed.error) } };
  }

  try {
    const png = await renderDeepAnalysisCard(parsed.data);
    return { ok: true, data: { dataUrl: `data:image/png;base64,${png.toString("base64")}` } };
  } catch (cause) {
    console.error("[market-analysis] önizleme çizilemedi:", cause);
    return { ok: false, error: { code: "RENDER_FAILED", message: "Önizleme çizilemedi.", cause } };
  }
}

/**
 * "Kaydet / İçerik Üret": iki takımın kartını çizip DRAFT olarak kaydeder. Takvimde bu maç için
 * planlanmış placeholder varsa onun üzerine yazılır (bkz. market-analysis-engine.ts).
 */
export async function saveMarketAnalysisAction(input: unknown): Promise<Result<{ id: string }>> {
  if (!(await getCurrentSession())) {
    return { ok: false, error: { code: "UNAUTHORIZED", message: UNAUTHORIZED_MESSAGE } };
  }
  const parsed = saveSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: { code: "INVALID_INPUT", message: firstIssue(parsed.error) } };

  const apiId = parseFixtureId(parsed.data.fixtureId);
  if (apiId === null) return { ok: false, error: { code: "INVALID_INPUT", message: "Önce bir maç seçin." } };
  // Yalnızca gerçek bir maça kayıt açılır (yanıt önbellekli).
  const fixture = await getFixtureById(apiId);
  if (!fixture.ok) return { ok: false, error: { code: fixture.error.code, message: fixture.error.message } };

  const saved = await createMarketAnalysisDraft(parsed.data);
  if (!saved.ok) return saved;

  revalidatePath("/calendar");
  revalidatePath("/dashboard/matches");
  return { ok: true, data: { id: saved.data.id } };
}

/**
 * "AI Analist": seçilen maçın gerçek verisinden (API-Football + Sportmonks) Claude'a iki takımın
 * analist metinlerini ve market tahminini yazdırır. Çıktıdaki her sayı veriyle karşılaştırılır;
 * dayanaksız sayılar `warnings` olarak döner (yayından önce admin görür). Ücretlidir — yalnızca
 * admin tıklamasıyla çalışır (bkz. CLAUDE.md 1.10).
 */
export async function generateExpertAnalysisAction(fixtureId: string): Promise<Result<ExpertAnalysisResult>> {
  if (!(await getCurrentSession())) {
    return { ok: false, error: { code: "UNAUTHORIZED", message: UNAUTHORIZED_MESSAGE } };
  }
  const apiId = parseFixtureId(fixtureId);
  if (apiId === null) return { ok: false, error: { code: "INVALID_INPUT", message: "Önce bir maç seçin." } };

  const stats = await getDeepAnalysisStats(apiId);
  if (!stats.ok) return { ok: false, error: { code: stats.error.code, message: stats.error.message } };
  return createExpertAnalysisDraft(fixtureId, stats.data);
}

const heroSchema = z.object({
  side: z.enum(["home", "away"]),
  teamName: text(60).min(1, "Takım adı boş olamaz."),
  colorHex: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Takım rengi #RRGGBB olmalı."),
  quality: z.enum(HERO_QUALITIES, "Kapak kalitesini seçin."),
});

/**
 * Kapak sahnesi üretimi (ücretli olabilir): kilit oyuncu fotoğrafı (kütüphaneden ya da yeni yükleme —
 * yeni yükleme kütüphaneye kaydedilir) → AI Upscale + birefnet kesim + sahne → kalıcı kapak PNG'si.
 * Kartın önizlemesi ve kaydı bu dosyayı kullanır; metin düzenlemeleri Fal.ai'ye tekrar gitmez.
 */
export async function generateAnalysisHeroAction(formData: FormData): Promise<Result<AnalysisHeroResult>> {
  if (!(await getCurrentSession())) {
    return { ok: false, error: { code: "UNAUTHORIZED", message: UNAUTHORIZED_MESSAGE } };
  }
  if (!isFalConfigured()) return { ok: false, error: { code: "NOT_CONFIGURED", message: "FAL_KEY tanımlı değil — kapak üretilemez." } };

  const field = (name: string) => {
    const value = formData.get(name);
    return typeof value === "string" ? value : "";
  };
  const parsed = heroSchema.safeParse({ side: field("side"), teamName: field("teamName"), colorHex: field("colorHex"), quality: field("quality") });
  if (!parsed.success) return { ok: false, error: { code: "INVALID_INPUT", message: firstIssue(parsed.error) } };
  const { side, teamName, colorHex, quality } = parsed.data;

  let player: Awaited<ReturnType<typeof resolveStudioImage>>;
  try {
    player = await resolveStudioImage(formData, `${side}Hero`, "PLAYER", `${teamName} kilit oyuncu fotoğrafı`);
  } catch {
    return { ok: false, error: { code: "STORAGE_FAILED", message: "Oyuncu fotoğrafı medya kütüphanesine kaydedilemedi." } };
  }
  if (!player.ok) return player;
  if (!player.data) return { ok: false, error: { code: "INVALID_INPUT", message: `${teamName} için kilit oyuncu fotoğrafı seçin veya yükleyin.` } };

  return createAnalysisHero({ player: player.data.image, colorHex, quality, label: `${teamName} kilit oyuncu` });
}
