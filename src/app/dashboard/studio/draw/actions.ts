"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createHash } from "node:crypto";
import { resolveArchivePhoto } from "@/lib/archive/picker-input";
import { reportJobStep, startResultJob } from "@/lib/jobs/studio-jobs";
import type { StudioJobStart } from "@/types/studio-job";
import { getCurrentSession } from "@/lib/auth/require-session";
import { UNAUTHORIZED_MESSAGE } from "@/lib/dashboard/action-utils";
import { drawParticipants, searchDrawTeams, seasonEuropeanDraws, type DrawParticipantsResult } from "@/lib/dashboard/draw-data";
import { compareDraws, createDrawDraft, renderDraw, type DrawComparison } from "@/lib/dashboard/draw-engine";
import { drawRequestSchema, drawStateSchema, type DrawRequest } from "@/lib/draw/state-schema";
import type { DrawState, DrawTeam } from "@/types/draw";
import type { Result } from "@/types/result";

type Fail = { ok: false; error: { code: string; message: string } };
const fail = (code: string, message: string): Fail => ({ ok: false, error: { code, message } });
const unauthorized = (): Fail => fail("UNAUTHORIZED", UNAUTHORIZED_MESSAGE);

/** Arşiv seçicisinin alan öneki (A · takım fotoğrafı). */
const PHOTO_FIELD = "photo";

function readRequest(formData: FormData): Result<DrawRequest> {
  let json: unknown = null;
  try {
    json = JSON.parse(String(formData.get("request") ?? "null"));
  } catch {
    return fail("INVALID_INPUT", "Kura verisi okunamadı.");
  }
  const parsed = drawRequestSchema.safeParse(json);
  if (!parsed.success) return fail("INVALID_INPUT", parsed.error.issues[0]?.message ?? "Kura verisi geçersiz.");
  if (parsed.data.roundIds.length !== parsed.data.states.length) return fail("INVALID_INPUT", "Tur bilgisi eksik.");
  return { ok: true, data: parsed.data };
}

/** A: fotoğraf odak takımın arşivinden (seçilen ya da — yalnızca kayıtta — yeni yüklenen). */
async function teamPhoto(formData: FormData, request: DrawRequest, allowUpload: boolean) {
  if (request.variant !== "TEAM" || !request.focusTeamId) return { ok: true as const, data: null };
  const source = allowUpload ? formData : new FormData();
  if (!allowUpload) {
    const id = formData.get(`${PHOTO_FIELD}PhotoId`);
    if (typeof id === "string" && id) source.set(`${PHOTO_FIELD}PhotoId`, id);
  }
  return resolveArchivePhoto(source, PHOTO_FIELD, [request.focusTeamId], null);
}

/** Kura öncesi hazırlık: turnuvanın katılımcıları API'den. */
export async function loadParticipantsAction(competitionId: unknown, season: unknown): Promise<Result<DrawParticipantsResult>> {
  if (!(await getCurrentSession())) return unauthorized();
  const parsed = z.object({ competitionId: z.number().int().positive(), season: z.number().int().min(2000).max(2100) }).safeParse({ competitionId, season });
  if (!parsed.success) return fail("INVALID_INPUT", "Geçersiz turnuva ya da sezon.");
  return drawParticipants(parsed.data.competitionId, parsed.data.season);
}

/** Bitmiş kuralar: sezonun ŞL/AL/KL lig aşaması fikstürlerinden Türk takımlarının rakipleri (tek tık). */
export async function loadSeasonDrawsAction(season: unknown): Promise<Result<{ states: DrawState[]; skipped: string[] }>> {
  if (!(await getCurrentSession())) return unauthorized();
  const parsed = z.number().int().min(2000).max(2100).safeParse(season);
  if (!parsed.success) return fail("INVALID_INPUT", "Geçersiz sezon.");
  return seasonEuropeanDraws(parsed.data);
}

/** Elle katılımcı: adla API araması. */
export async function searchDrawTeamsAction(query: unknown): Promise<Result<DrawTeam[]>> {
  if (!(await getCurrentSession())) return unauthorized();
  return typeof query === "string" ? searchDrawTeams(query) : fail("INVALID_INPUT", "Arama metni yok.");
}

/** İş anahtarı: aynı istek + fotoğraf (önizleme her girişte tetiklenir; farklı girdi ayrı iş). */
const drawKey = (formData: FormData) => createHash("sha256").update(String(formData.get("request") ?? "")).update(String(formData.get(`${PHOTO_FIELD}PhotoId`) ?? "")).digest("hex").slice(0, 16);

/**
 * Önizleme ve kayıt arka plan işidir (eski formalı arşiv fotoğrafı ilk kullanımda Fal ile büyütülür; yeni
 * yükleme arşive girerken büyütülür — 120 sn sınırı, Cloudflare 100 sn).
 */
export async function previewDrawAction(formData: FormData): Promise<Result<StudioJobStart>> {
  if (!(await getCurrentSession())) return unauthorized();
  return startResultJob("draw-preview", `draw-preview:${drawKey(formData)}`, "Fotoğraf hazırlanıyor", () => previewDraw(formData));
}

export async function saveDrawAction(formData: FormData): Promise<Result<StudioJobStart>> {
  if (!(await getCurrentSession())) return unauthorized();
  return startResultJob("draw-save", `draw-save:${drawKey(formData)}`, "Fotoğraf hazırlanıyor", () => saveDraw(formData));
}

/** Önizleme: kaydetmez, arşive yazmaz. */
async function previewDraw(formData: FormData): Promise<Result<{ dataUrls: string[] }>> {
  const request = readRequest(formData);
  if (!request.ok) return request;
  const photo = await teamPhoto(formData, request.data, false);
  if (!photo.ok) return photo;
  reportJobStep("Kart çiziliyor");
  const rendered = await renderDraw(request.data, photo.data?.image ?? null);
  if (!rendered.ok) return rendered;
  return { ok: true, data: { dataUrls: rendered.data.pages.map((page) => `data:image/png;base64,${page.toString("base64")}`) } };
}

/** Kaydet: DRAFT (yayın manuel); girilen eşleşmeler kayıtta. */
async function saveDraw(formData: FormData): Promise<Result<{ id: string }>> {
  const request = readRequest(formData);
  if (!request.ok) return request;
  const photo = await teamPhoto(formData, request.data, true);
  if (!photo.ok) return photo;
  reportJobStep("Kart çiziliyor ve kaydediliyor");
  const saved = await createDrawDraft(request.data, photo.data ? { image: photo.data.image, photoId: photo.data.photoId } : null);
  if (!saved.ok) return saved;
  try {
    revalidatePath("/dashboard/plan");
    revalidatePath("/dashboard/studio/draw");
  } catch {
    // istek kapsamı kapanmış — sorun değil
  }
  return saved;
}

/** Kura sonrası: girilen eşleşmeler ile API fikstürü — yalnızca uyarı. */
export async function compareDrawAction(input: unknown): Promise<Result<DrawComparison[]>> {
  if (!(await getCurrentSession())) return unauthorized();
  const parsed = z.object({ states: z.array(drawStateSchema).min(1).max(3), roundIds: z.array(z.string().max(8)).min(1).max(3) }).safeParse(input);
  if (!parsed.success) return fail("INVALID_INPUT", "Kura verisi geçersiz.");
  return compareDraws(parsed.data.states, parsed.data.roundIds);
}
