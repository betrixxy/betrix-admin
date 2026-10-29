"use server";

import { clock, shortDate } from "@/lib/format/dates";
import { fixtureOrigins } from "@/lib/dashboard/team-origin";
import { withCardNames } from "@/lib/dashboard/lineup-names";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentSession } from "@/lib/auth/require-session";
import { UNAUTHORIZED_MESSAGE } from "@/lib/dashboard/action-utils";
import { lineupDraftFromReference, lineupIssues } from "@/lib/dashboard/lineup-draft";
import { isValidFormation } from "@/lib/dashboard/lineup-formations";
import { createLineupDraft } from "@/lib/dashboard/lineup-engine";
import { renderLineupCard } from "@/lib/dashboard/lineup-render";
import { getFixtureById, getLineupReference, parseFixtureId } from "@/lib/services/api-football";
import { resolveLineupHeroPhoto } from "@/lib/dashboard/lineup-hero-photo";
import { LINEUP_SIZE, LINEUP_TEMPLATE_STYLES, type LineupDraft, type LineupTemplateStyle, type TeamLineupReference } from "@/types/lineup";
import type { Result } from "@/types/result";
import { DEFAULT_SOCIAL_FORMAT, SOCIAL_FORMAT_IDS } from "@/types/studio-formats";
import type { Fixture } from "@/types/sports";

export interface LineupLoadResult {
  draft: LineupDraft;
  home: Pick<TeamLineupReference, "source" | "squad">;
  away: Pick<TeamLineupReference, "source" | "squad">;
}

function matchLabelFor(fixture: Fixture): string {
  // Ortak tarih kuralı: kısa tarih "30.10" · saat "20:00" (tr-TR biçimi "30/10" verirdi).
  return `${fixture.competition.name} · ${shortDate(fixture.kickoffUtc)} · ${clock(fixture.kickoffUtc)}`;
}

function unauthorized<T>(): Result<T> {
  return { ok: false, error: { code: "UNAUTHORIZED", message: UNAUTHORIZED_MESSAGE } };
}

/** Maçın açıklanmış 11'i, yoksa iki takımın son maçtaki ilk 11'i + güncel kadrolar → form taslağı. */
export async function loadLineupAction(fixtureId: string): Promise<Result<LineupLoadResult>> {
  if (!(await getCurrentSession())) return unauthorized();
  const apiId = parseFixtureId(fixtureId);
  if (apiId === null) return { ok: false, error: { code: "INVALID_INPUT", message: "Geçersiz maç." } };

  const raw = await getLineupReference(apiId, fixtureId);
  if (!raw.ok) return { ok: false, error: { code: raw.error.code, message: raw.error.message } };
  // Kart adları (Türkçe karakter + uyruk kökeni) form açılmadan çözülür.
  const reference = { ok: true as const, data: await withCardNames(raw.data) };
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
  // Kapak: arşiv fotoğrafının kimliği (sunucu takım + forma doğrular) ve elle ayar (null = otomatik).
  heroPhotoId: z.union([z.literal(""), z.string().cuid("Kapak fotoğrafı geçersiz.")]),
  heroAdjust: z.object({ x: z.number().min(-1).max(1), y: z.number().min(-1).max(1), zoom: z.number().min(1).max(2).nullable() }).nullable(),
  formation: z.string().refine(isValidFormation, "Diziliş geçersiz (ör. 4-2-3-1, toplam 10 saha oyuncusu)."),
  slots: z
    .array(z.object({ playerId: z.number().int().nullable(), name: text(40), number: z.string().regex(/^\d{0,2}$/, "Forma numarası 0-99 olmalı."), origin: z.enum(["tr", "intl"]).nullable().optional() }))
    .length(LINEUP_SIZE),
  coach: text(60),
});
const templateStyle = z.enum(LINEUP_TEMPLATE_STYLES);
const format = z.enum(SOCIAL_FORMAT_IDS).default(DEFAULT_SOCIAL_FORMAT);
const previewSchema = z.object({ templateStyle, team: teamSchema, opponentName: text(60), opponentLogoUrl: text(500), headline: text(30), matchLabel: text(80), format, fixtureId: z.string().optional(), side: z.enum(["home", "away"]).optional() });
const saveSchema = z.object({ fixtureId: z.string(), templateStyle, headline: text(30), matchLabel: text(80), format, home: teamSchema, away: teamSchema });

function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Form alanları geçersiz.";
}

/** Tek takımın kartını çizer — kaydetmez (yalnızca önizleme). */
export async function previewLineupAction(input: unknown): Promise<Result<{ dataUrl: string; templateStyle: LineupTemplateStyle }>> {
  if (!(await getCurrentSession())) return unauthorized();
  const parsed = previewSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: { code: "INVALID_INPUT", message: firstIssue(parsed.error) } };

  try {
    const { fixtureId, side, ...input } = parsed.data;
    // Kapak fotoğrafı yalnızca maçtan ve taraftan doğrulanabilir (o takımın formalı arşiv fotoğrafı).
    if (input.templateStyle === "hero_list" && input.team.heroPhotoId && (!fixtureId || !side)) {
      return { ok: false, error: { code: "INVALID_INPUT", message: "Kapak fotoğrafı için önce maçı seçin." } };
    }
    const heroPhoto = fixtureId && side ? await resolveLineupHeroPhoto(fixtureId, side, input.team, input.templateStyle) : { ok: true as const, data: null };
    if (!heroPhoto.ok) return heroPhoto;
    const origins = await fixtureOrigins(fixtureId ?? null);
    const sideOrigins = origins && side ? { team: side === "home" ? origins.home : origins.away, opponent: side === "home" ? origins.away : origins.home } : undefined;
    const rendered = await renderLineupCard({ ...input, heroPhoto: heroPhoto.data, ...(sideOrigins ? { origins: sideOrigins } : {}) });
    if (!rendered.ok) return rendered;
    const { png, templateStyle } = rendered.data;
    return { ok: true, data: { dataUrl: `data:image/png;base64,${png.toString("base64")}`, templateStyle } };
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
  revalidatePath("/dashboard/plan");
  revalidatePath("/dashboard/matches");
  return { ok: true, data: saved.data };
}
