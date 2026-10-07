"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentSession } from "@/lib/auth/require-session";
import { UNAUTHORIZED_MESSAGE } from "@/lib/dashboard/action-utils";
import { lineupDraftFromReference, lineupIssues } from "@/lib/dashboard/lineup-draft";
import { isValidFormation } from "@/lib/dashboard/lineup-formations";
import { createLineupDraft } from "@/lib/dashboard/lineup-engine";
import { renderLineupCard } from "@/lib/dashboard/lineup-render";
import { getFixtureById, getLineupReference, parseFixtureId } from "@/lib/services/api-football";
import { getPlayerCutout, playerCutoutUrl } from "@/lib/dashboard/match-day-cache";
import { resolveStudioImage } from "@/lib/dashboard/studio-image-input";
import { isFalConfigured } from "@/lib/services/fal";
import { LINEUP_HERO_PATTERN, LINEUP_SIZE, type LineupDraft, type TeamLineupReference } from "@/types/lineup";
import type { Result } from "@/types/result";
import type { Fixture } from "@/types/sports";

export interface LineupLoadResult {
  draft: LineupDraft;
  home: Pick<TeamLineupReference, "source" | "squad">;
  away: Pick<TeamLineupReference, "source" | "squad">;
}

const KICKOFF_FORMAT = new Intl.DateTimeFormat("tr-TR", {
  timeZone: "Europe/Istanbul",
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function matchLabelFor(fixture: Fixture): string {
  return `${fixture.competition.name} · ${KICKOFF_FORMAT.format(new Date(fixture.kickoffUtc)).replace(" ", " · ")}`;
}

function unauthorized<T>(): Result<T> {
  return { ok: false, error: { code: "UNAUTHORIZED", message: UNAUTHORIZED_MESSAGE } };
}

/** Maçın açıklanmış 11'i, yoksa iki takımın son maçtaki ilk 11'i + güncel kadrolar → form taslağı. */
export async function loadLineupAction(fixtureId: string): Promise<Result<LineupLoadResult>> {
  if (!(await getCurrentSession())) return unauthorized();
  const apiId = parseFixtureId(fixtureId);
  if (apiId === null) return { ok: false, error: { code: "INVALID_INPUT", message: "Geçersiz maç." } };

  const reference = await getLineupReference(apiId, fixtureId);
  if (!reference.ok) return { ok: false, error: { code: reference.error.code, message: reference.error.message } };
  const { home, away, fixture } = reference.data;
  return {
    ok: true,
    data: {
      draft: lineupDraftFromReference(reference.data, matchLabelFor(fixture)),
      home: { source: home.source, squad: home.squad },
      away: { source: away.source, squad: away.squad },
    },
  };
}

const text = (max: number) => z.string().trim().max(max);
const teamSchema = z.object({
  teamName: text(60).min(1, "Takım adı boş olamaz."),
  logoUrl: text(500),
  colorHex: z.string().regex(/^(#[0-9a-fA-F]{6})?$/, "Forma rengi #RRGGBB olmalı."),
  heroImageUrl: z.string().refine((value) => value === "" || LINEUP_HERO_PATTERN.test(value), "Kapak görseli geçersiz."),
  formation: z.string().refine(isValidFormation, "Diziliş geçersiz (ör. 4-2-3-1, toplam 10 saha oyuncusu)."),
  slots: z
    .array(z.object({ playerId: z.number().int().nullable(), name: text(40), number: z.string().regex(/^\d{0,2}$/, "Forma numarası 0-99 olmalı.") }))
    .length(LINEUP_SIZE),
  coach: text(60),
});
const previewSchema = z.object({ team: teamSchema, opponentName: text(60), opponentLogoUrl: text(500), headline: text(30), matchLabel: text(80) });
const saveSchema = z.object({ fixtureId: z.string(), headline: text(30), matchLabel: text(80), home: teamSchema, away: teamSchema });

function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Form alanları geçersiz.";
}

/** Tek takımın kartını çizer — kaydetmez (yalnızca önizleme). */
export async function previewLineupAction(input: unknown): Promise<Result<{ dataUrl: string }>> {
  if (!(await getCurrentSession())) return unauthorized();
  const parsed = previewSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: { code: "INVALID_INPUT", message: firstIssue(parsed.error) } };

  try {
    const png = await renderLineupCard(parsed.data);
    return { ok: true, data: { dataUrl: `data:image/png;base64,${png.toString("base64")}` } };
  } catch (cause) {
    console.error("[lineup] önizleme çizilemedi:", cause);
    return { ok: false, error: { code: "RENDER_FAILED", message: "Önizleme çizilemedi.", cause } };
  }
}

/** "Kaydet / İçerik Üret": iki kartı çizip DRAFT olarak kaydeder (onaysız yayına hazır sayılmaz). */
export async function saveLineupAction(input: unknown): Promise<Result<{ id: string }>> {
  if (!(await getCurrentSession())) return unauthorized();
  const parsed = saveSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: { code: "INVALID_INPUT", message: firstIssue(parsed.error) } };

  const issues = [...lineupIssues(parsed.data.home), ...lineupIssues(parsed.data.away)];
  if (issues.length > 0) return { ok: false, error: { code: "INVALID_INPUT", message: issues.join(" ") } };

  const apiId = parseFixtureId(parsed.data.fixtureId);
  if (apiId === null) return { ok: false, error: { code: "INVALID_INPUT", message: "Önce bir maç seçin." } };
  const fixture = await getFixtureById(apiId);
  if (!fixture.ok) return { ok: false, error: { code: fixture.error.code, message: fixture.error.message } };

  const saved = await createLineupDraft(parsed.data);
  if (!saved.ok) return saved;
  revalidatePath("/calendar");
  revalidatePath("/dashboard/matches");
  return { ok: true, data: saved.data };
}

export interface LineupHeroResult {
  /** Şeffaf oyuncu kesimi — `/api/files/generated/cutout-v1-<sha256>.png`. */
  heroImageUrl: string;
  /** Bu üretimdeki ücretli Fal.ai çağrısı (aynı fotoğraf daha önce kesildiyse 0). */
  paidCalls: number;
}

/**
 * Kapak oyuncusu (ücretli olabilir): kütüphaneden seçilen ya da yeni yüklenen fotoğraf (yeni
 * yükleme kütüphaneye kaydedilir) → gerekirse AI Upscale → birefnet kesim. Kesim fotoğraf
 * başına önbelleklidir; kart önizlemesi ve kaydı bu dosyayı kullanır, Fal.ai'ye tekrar gitmez.
 */
export async function generateLineupHeroAction(formData: FormData): Promise<Result<LineupHeroResult>> {
  if (!(await getCurrentSession())) return unauthorized();
  if (!isFalConfigured()) return { ok: false, error: { code: "NOT_CONFIGURED", message: "FAL_KEY tanımlı değil — kapak kesimi üretilemez." } };

  const side = formData.get("side");
  const teamName = formData.get("teamName");
  if ((side !== "home" && side !== "away") || typeof teamName !== "string" || !teamName.trim()) {
    return { ok: false, error: { code: "INVALID_INPUT", message: "Takım seçilmedi." } };
  }
  const label = `${teamName.trim().slice(0, 60)} kapak oyuncusu`;

  let player: Awaited<ReturnType<typeof resolveStudioImage>>;
  try {
    player = await resolveStudioImage(formData, `${side}Hero`, "PLAYER", label);
  } catch {
    return { ok: false, error: { code: "STORAGE_FAILED", message: "Oyuncu fotoğrafı medya kütüphanesine kaydedilemedi." } };
  }
  if (!player.ok) return player;
  if (!player.data) return { ok: false, error: { code: "INVALID_INPUT", message: `${teamName} için kapak oyuncusu fotoğrafı seçin veya yükleyin.` } };

  const cutout = await getPlayerCutout(player.data.image, label);
  if (!cutout.ok) return cutout;
  return { ok: true, data: { heroImageUrl: playerCutoutUrl(player.data.image), paidCalls: cutout.data.paidCalls } };
}
