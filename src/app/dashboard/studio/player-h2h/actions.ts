"use server";

import { z } from "zod";
import { getCurrentSession } from "@/lib/auth/require-session";
import { refreshDashboard, UNAUTHORIZED_MESSAGE } from "@/lib/dashboard/action-utils";
import { createH2HDraft, loadH2HPlayers, renderH2H, type H2HRequest } from "@/lib/dashboard/player-h2h-engine";
import { parsePlayerKey } from "@/lib/player-h2h/keys";
import { h2hMatchContext, photoHasFace, playerKitPhotos, type H2HMatchContext, type H2HPhotoOption } from "@/lib/dashboard/player-h2h-studio";
import { FACE_NOT_FOUND_WARNING } from "@/lib/dashboard/player-h2h-photo";
import { comparisonPosition, comparisonWarnings } from "@/lib/player-h2h/checks";
import { buildHero, buildRows } from "@/lib/player-h2h/rows";
import { defaultMode, STAT_META } from "@/lib/player-h2h/stats";
import { parseFixtureId } from "@/lib/services/api-football";
import { MATCH_DAY_FORMAT_IDS } from "@/types/match-day";
import { H2H_MODES, H2H_SCOPES, type H2HDropped, type H2HMode } from "@/types/player-h2h";
import type { Result } from "@/types/result";
import type { StudioJobStart } from "@/types/studio-job";
import { reportJobStep, startResultJob } from "@/lib/jobs/studio-jobs";

/**
 * Oyuncu karşılaştırma stüdyosu. Veri her çağrıda SUNUCUDA okunur; istemciden yalnızca seçimler gelir
 * (oyuncu anahtarı, kapsam, adalet, format, fotoğraf, kırpma ayarı, maç kimliği). Maç bilgisi istemciden
 * alınmaz, kimlikten yeniden okunur.
 */

type Fail = { ok: false; error: { code: string; message: string } };
const fail = (code: string, message: string): Fail => ({ ok: false, error: { code, message } });
const unauthorized = async (): Promise<Fail | null> => ((await getCurrentSession()) ? null : fail("UNAUTHORIZED", UNAUTHORIZED_MESSAGE));

const fixtureIdSchema = z.string().regex(/^api-football-\d+$/);

export async function matchContextAction(fixtureId: string): Promise<Result<H2HMatchContext>> {
  const denied = await unauthorized();
  if (denied) return denied;
  return matchContext(fixtureId);
}

/** Oturumu çağıran doğrular (arka plan işinde oturum çerezi okunamaz). */
async function matchContext(fixtureId: string): Promise<Result<H2HMatchContext>> {
  const parsed = fixtureIdSchema.safeParse(fixtureId);
  const apiId = parsed.success ? parseFixtureId(parsed.data) : null;
  if (apiId === null) return fail("INVALID_INPUT", "Geçersiz maç.");
  return h2hMatchContext(fixtureId, apiId);
}

export async function playerPhotosAction(key: string): Promise<Result<H2HPhotoOption[]>> {
  const denied = await unauthorized();
  if (denied) return denied;
  const player = parsePlayerKey(key);
  if (!player) return fail("INVALID_INPUT", "Geçersiz oyuncu.");
  return { ok: true, data: await playerKitPhotos(player.playerId, player.teamId) };
}

/** Fotoğraf seçicinin uyarısı: yüz bulunamadıysa metin, bulunduysa null. */
export async function photoFaceAction(photoId: string): Promise<Result<string | null>> {
  const denied = await unauthorized();
  if (denied) return denied;
  const face = await photoHasFace(z.string().cuid().safeParse(photoId).success ? photoId : "");
  if (!face.ok) return face;
  return { ok: true, data: face.data ? null : FACE_NOT_FOUND_WARNING };
}

const DROP_REASONS: Record<H2HDropped["reason"], string> = { MISSING_LEFT: "soldaki oyuncuda veri yok", MISSING_RIGHT: "sağdaki oyuncuda veri yok", MISSING_BOTH: "iki oyuncuda da veri yok", OVERFLOW: "sığmadı" };

export interface H2HAnalysis {
  defaultMode: H2HMode;
  warnings: string[];
  /** Kahramanlar ve satırlar (4:5 kapasitesiyle) — stüdyoda özet. */
  hero: string[];
  rows: string[];
  dropped: string[];
  samples: [string, string];
}

const analyzeSchema = z.object({ left: z.string(), right: z.string(), scope: z.enum(H2H_SCOPES), mode: z.enum(H2H_MODES).nullable() });

/** Seçim değişince: veri, varsayılan adalet, uyarılar (tek satır), gelen/düşen satırlar. Kaleci × saha oyuncusu → hata. */
export async function analyzeH2HAction(input: z.infer<typeof analyzeSchema>): Promise<Result<H2HAnalysis>> {
  const denied = await unauthorized();
  if (denied) return denied;
  const parsed = analyzeSchema.safeParse(input);
  const [left, right] = parsed.success ? [parsePlayerKey(parsed.data.left), parsePlayerKey(parsed.data.right)] : [null, null];
  if (!parsed.success || !left || !right) return fail("INVALID_INPUT", "Geçersiz seçim.");
  const players = await loadH2HPlayers(left, right, parsed.data.scope);
  if (!players.ok) return players;
  const [a, b] = players.data;
  const position = comparisonPosition(a, b);
  if (!position.ok) return position;
  const mode = parsed.data.mode ?? defaultMode(a.minutes, b.minutes);
  const { rows, dropped } = buildRows(a, b, position.data, mode);
  const sample = (p: typeof a) => `${p.fullName}: ${p.appearances} maç · ${p.minutes} dk · ${p.freshness.source === "api-football" ? "API-Football" : "Sportmonks"}${p.freshness.addedMatches ? ` (+${p.freshness.addedMatches} maç maç verisinden)` : ""}`;
  return {
    ok: true,
    data: {
      defaultMode: defaultMode(a.minutes, b.minutes),
      warnings: comparisonWarnings(a, b),
      hero: buildHero(a, b, position.data, mode).map((row) => `${row.label} ${row.leftText} – ${row.rightText}`),
      rows: rows.map((row) => row.label),
      dropped: dropped.filter((d) => d.key !== "rating").map((d) => `${STAT_META[d.key].label} (${DROP_REASONS[d.reason]})`),
      samples: [sample(a), sample(b)],
    },
  };
}

const adjustSchema = z.object({ x: z.number().min(-1).max(1), y: z.number().min(-1).max(1), zoom: z.number().min(1).max(2).nullable() }).nullable();
const sideSchema = z.object({ key: z.string(), photoId: z.string().cuid().nullable(), poster: adjustSchema, portrait: adjustSchema });
const requestSchema = z.object({
  left: sideSchema,
  right: sideSchema,
  scope: z.enum(H2H_SCOPES),
  mode: z.enum(H2H_MODES).nullable(),
  format: z.enum(MATCH_DAY_FORMAT_IDS),
  fixtureId: fixtureIdSchema.nullable(),
});
export type H2HStudioRequest = z.infer<typeof requestSchema>;

const toAdjust = (adjust: z.infer<typeof adjustSchema>) => (adjust ? { offset: { x: adjust.x, y: adjust.y }, ...(adjust.zoom === null ? {} : { zoom: adjust.zoom }) } : undefined);

async function toRequest(input: H2HStudioRequest): Promise<Result<H2HRequest>> {
  const parsed = requestSchema.safeParse(input);
  if (!parsed.success) return fail("INVALID_INPUT", parsed.error.issues[0]?.message ?? "Form geçersiz.");
  const { left, right, scope, mode, format, fixtureId } = parsed.data;
  const [l, r] = [parsePlayerKey(left.key), parsePlayerKey(right.key)];
  if (!l || !r) return fail("INVALID_INPUT", "İki oyuncuyu da seçin.");
  let match: H2HRequest["match"] = null;
  if (fixtureId) {
    const context = await matchContext(fixtureId);
    if (!context.ok) return context;
    match = { fixtureId, homeTeam: context.data.homeTeam.name, awayTeam: context.data.awayTeam.name, kickoffUtc: context.data.kickoffUtc };
  }
  const side = (player: { playerId: number; teamId: number }, s: typeof left) => ({ ...player, photoId: s.photoId, posterAdjust: toAdjust(s.poster), portraitAdjust: toAdjust(s.portrait) });
  return { ok: true, data: { left: side(l, left), right: side(r, right), scope, mode, format, match } };
}

const h2hKey = (input: H2HStudioRequest) => [input.left.key, input.right.key, input.format, input.fixtureId ?? "manual"].join(":");

/**
 * Önizleme ve kayıt arka plan işidir (sezon + maç bazlı veri, fotoğraf büyütme, iki sayfa çizimi — Cloudflare
 * 100 sn sınırı): eylem iş kimliğini hemen döner, stüdyo bitene kadar sorar.
 */
export async function previewH2HAction(input: H2HStudioRequest): Promise<Result<StudioJobStart>> {
  const denied = await unauthorized();
  if (denied) return denied;
  return startResultJob("h2h-preview", `h2h-preview:${h2hKey(input)}`, "Oyuncu verisi alınıyor", () => previewH2H(input));
}

export async function saveH2HAction(input: H2HStudioRequest): Promise<Result<StudioJobStart>> {
  const denied = await unauthorized();
  if (denied) return denied;
  return startResultJob("h2h-save", `h2h-save:${h2hKey(input)}`, "Oyuncu verisi alınıyor", () => saveH2H(input));
}

/** Önizleme: kaydetmez. */
async function previewH2H(input: H2HStudioRequest): Promise<Result<{ dataUrls: [string, string]; warnings: string[] }>> {
  const request = await toRequest(input);
  if (!request.ok) return request;
  reportJobStep("Kartlar çiziliyor");
  const rendered = await renderH2H(request.data);
  if (!rendered.ok) return rendered;
  const [poster, compare] = rendered.data.pages.map((png) => `data:image/png;base64,${png.toString("base64")}`);
  const noFace = rendered.data.noFace.map((name) => `${name}: ${FACE_NOT_FOUND_WARNING}`);
  return { ok: true, data: { dataUrls: [poster ?? "", compare ?? ""], warnings: [...rendered.data.warnings, ...noFace] } };
}

/** Kaydet: carousel'i çizer, DRAFT açar; stüdyo inceleme ekranına yönlendirir. */
async function saveH2H(input: H2HStudioRequest): Promise<Result<{ id: string }>> {
  const request = await toRequest(input);
  if (!request.ok) return request;
  reportJobStep("Kartlar çiziliyor ve kaydediliyor");
  const saved = await createH2HDraft(request.data);
  if (!saved.ok) return saved;
  try {
    refreshDashboard();
  } catch {
    // istek kapsamı kapanmış — sorun değil (sayfalar force-dynamic)
  }
  return { ok: true, data: { id: saved.data.id } };
}
