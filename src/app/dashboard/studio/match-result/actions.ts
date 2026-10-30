"use server";

import sharp from "sharp";
import { z } from "zod";
import { resolveArchivePhoto } from "@/lib/archive/picker-input";
import { getCurrentSession } from "@/lib/auth/require-session";
import { refreshDashboard, UNAUTHORIZED_MESSAGE } from "@/lib/dashboard/action-utils";
import { reportJobStep, startStudioJob } from "@/lib/jobs/studio-jobs";
import { MATCH_DAY_FRAMES } from "@/lib/dashboard/match-day-formats";
import { prepareMatchPhoto } from "@/lib/dashboard/match-photo";
import { loadMediaAssetImage, matchPhotoTag } from "@/lib/dashboard/media-library";
import { createMatchResultCard, type MatchPhotoInput } from "@/lib/dashboard/match-result-engine";
import { validateMatchResultFixture } from "@/lib/dashboard/match-result-studio";
import { loadMatchStatsFacts } from "@/lib/dashboard/match-stats-studio";
import { loadPlayerStatsFacts } from "@/lib/dashboard/player-stats-studio";
import { warmTeamColors } from "@/lib/dashboard/team-colors";
import { PLAYER_PAGE_MODES, playerPagePlan } from "@/lib/player-stats/plan";
import { COMPETITION_COLORS, resultAccentHex } from "@/lib/dashboard/match-result-theme";
import { getMatchResultRaw, parseFixtureId } from "@/lib/services/api-football";
import type { ApiFootballFixtureResultRaw } from "@/lib/services/api-football/types";
import { matchResultGeometry } from "@/skills/render-engine/templates/match-result/geometry";
import { MATCH_DAY_FORMAT_IDS } from "@/types/match-day";
import { MATCH_RESULT_TEMPLATE_IDS, type MatchPhotoPreviewState, type MatchResultActionState, type MatchResultFacts } from "@/types/match-result";
import type { Result } from "@/types/result";

const optionalPlayerId = z.union([z.literal(""), z.coerce.number().int().positive()]).transform((value) => (value === "" ? null : value));
/** Elle kaydırma −1..1 (kadraj boyunun yarısı); boş = otomatik. */
const offset = z.union([z.literal(""), z.coerce.number().min(-1).max(1)]).transform((value) => (value === "" ? 0 : value));
/** Elle zoom 1..1,6; boş = otomatik (yüzler yazısız bölgeye sığana kadar). */
const zoom = z.union([z.literal(""), z.coerce.number().min(1).max(1.6)]).transform((value) => (value === "" ? undefined : value));

const photoSchema = z.object({
  fixtureId: z.string().regex(/^api-football-\d+$/, "Maç seçilmedi — Maç Merkezi'nden açın."),
  template: z.enum(MATCH_RESULT_TEMPLATE_IDS, "Bir şablon seçin."),
  format: z.enum(MATCH_DAY_FORMAT_IDS, "Bir platform formatı seçin."),
  offsetX: offset,
  offsetY: offset,
  zoom,
});

/** "Oyuncu sayfasını da ekle": yok · A Maçın Oyuncusu · B Maçın En İyileri (3 / 5). */
const PLAYER_PAGES = { SPOTLIGHT: { template: "SPOTLIGHT", count: undefined }, TOP_3: { template: "TOP_PLAYERS", count: 3 }, TOP_5: { template: "TOP_PLAYERS", count: 5 } } as const;
const playerPage = z.union([z.literal(""), z.enum(["SPOTLIGHT", "TOP_3", "TOP_5"])]);

const cardSchema = photoSchema.extend({ mvpId: optionalPlayerId, photoIsMvp: z.boolean(), includeStats: z.boolean(), playerPage, playerPageMode: z.enum(PLAYER_PAGE_MODES).catch("WHEN_READY") });

const FIELDS = ["fixtureId", "template", "format", "offsetX", "offsetY", "zoom", "mvpId", "playerPage", "playerPageMode"] as const;

function text(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

type Fail = { ok: false; error: string };

/** Form → doğrulanmış alanlar + maç (sunucuda yeniden çekilir) + maç fotoğrafı. */
async function resolveInput(formData: FormData): Promise<
  | { ok: true; data: z.infer<typeof cardSchema>; facts: MatchResultFacts; photo: MatchPhotoInput; raw: ApiFootballFixtureResultRaw }
  | Fail
> {
  const parsed = cardSchema.safeParse({ ...Object.fromEntries(FIELDS.map((name) => [name, text(formData, name)])), photoIsMvp: formData.get("photoIsMvp") === "on", includeStats: formData.get("includeStats") === "on" });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Geçersiz form verisi." };
  const data = parsed.data;

  const apiId = parseFixtureId(data.fixtureId);
  const raw = apiId ? await getMatchResultRaw(apiId) : null;
  if (!raw?.ok) return { ok: false, error: `Maç verisi alınamadı: ${raw?.error.message ?? "geçersiz maç kimliği"}` };
  const validated = validateMatchResultFixture(raw.data, new Date());
  if (!validated.ok) return { ok: false, error: validated.error.message };
  const facts = validated.data;
  if (!raw.data) return { ok: false, error: "Maç bulunamadı." };
  const fixtureRaw = raw.data;
  // Takım rengi ortak kaynaktan (vurgu, tonlama, 02/03) — tablo dışı takım: logodan otomatik.
  await warmTeamColors([{ id: facts.home.id, name: fixtureRaw.teams.home.name, logoUrl: facts.home.logoUrl }, { id: facts.away.id, name: fixtureRaw.teams.away.name, logoUrl: facts.away.logoUrl }]);

  const photo = await resolvePhoto(formData, data, facts);
  return photo.ok ? { ok: true, data, facts, photo: photo.data, raw: fixtureRaw } : { ok: false, error: photo.error.message };
}

/**
 * Maç fotoğrafı — Fotoğraf Arşivi seçicisinden (`resolveArchivePhoto`): arşivden seçilen fotoğraf ya
 * da yeni yükleme (seçilen kişi/takım klasörüne, bu maçın etiketiyle) maçtaki takımlardan birine ait
 * olmalı; kart büyütülmüş sürümü kullanır. Eski kütüphane alanı (`photoAssetId`) bir sürüm boyunca
 * okunmaya devam eder. Fotoğraf yoksa kart üretilmez.
 */
async function resolvePhoto(formData: FormData, data: z.infer<typeof photoSchema>, facts: MatchResultFacts): Promise<Result<MatchPhotoInput>> {
  const assetId = text(formData, "photoAssetId");
  if (assetId) {
    const tag = await matchPhotoTag(assetId, data.fixtureId);
    if (!tag) return { ok: false, error: { code: "PHOTO_NOT_FOR_MATCH", message: "Seçilen kütüphane fotoğrafı bu maça ait değil." } };
    const loaded = await loadMediaAssetImage(assetId, "MATCH_PHOTO");
    return loaded.ok ? { ok: true, data: { image: loaded.data.image, fileUrl: loaded.data.fileUrl, playerId: tag.playerId } } : loaded;
  }
  try {
    const resolved = await resolveArchivePhoto(formData, "photo", [facts.home.id, facts.away.id], data.fixtureId);
    if (!resolved.ok) return resolved;
    if (!resolved.data) return { ok: false, error: { code: "PHOTO_MISSING", message: "Maç fotoğrafı yok — arşivden seçin ya da yükleyin. Kart üretilmedi." } };
    return { ok: true, data: { image: resolved.data.image, fileUrl: resolved.data.fileUrl, playerId: resolved.data.playerApiId, kitTeamId: resolved.data.kitTeamId, photoId: resolved.data.photoId } };
  } catch (error: unknown) {
    console.error("[match-result] arşiv fotoğrafı çözülemedi:", error);
    return { ok: false, error: { code: "ARCHIVE_FAILED", message: "Maç fotoğrafı arşivden alınamadı ya da arşive kaydedilemedi." } };
  }
}

/**
 * "Maç Sonucu" kartı: form → doğrulama → maç → fotoğraf → motor (kalite + yerleşim kapıları). DRAFT doğar.
 * Üretim ARKA PLAN İŞİdir (Fal büyütme + iki çizim 100 sn'yi aşabilir — Cloudflare yanıt sınırı): eylem iş
 * kimliğini hemen döner, stüdyo durumu sorar. Aynı maç + format + şablon için çalışan iş varsa ona bağlanılır.
 */
export async function generateMatchResultAction(_prevState: MatchResultActionState, formData: FormData): Promise<MatchResultActionState> {
  if (!(await getCurrentSession())) return { error: UNAUTHORIZED_MESSAGE };
  const job = startStudioJob<MatchResultActionState>({
    kind: "match-result",
    key: `match-result:${text(formData, "fixtureId")}:${text(formData, "format")}:${text(formData, "template")}`,
    firstStep: "Maç verisi alınıyor",
    run: () => runMatchResult(formData),
    fail: (message) => ({ error: message }),
  });
  return { job };
}

async function runMatchResult(formData: FormData): Promise<MatchResultActionState> {
  const input = await resolveInput(formData);
  if (!input.ok) return { error: input.error };
  const { data, facts, photo } = input;
  // "İstatistik sayfasını da ekle": 02 aynı DRAFT'ta carousel'in ikinci görseli.
  if (data.includeStats) reportJobStep("İstatistik verisi alınıyor (02)");
  const stats = data.includeStats ? await loadMatchStatsFacts(input.raw) : null;
  if (data.includeStats && !stats) return { error: "Maç istatistikleri alınamadı — kart üretilmedi." };
  // "Oyuncu sayfasını da ekle" seti kilitlemez: veri kesinleşmediyse 01 + 02 şimdi, 03 hazır olunca (ya da "şimdi üret" ile geçici).
  const page = data.playerPage ? PLAYER_PAGES[data.playerPage] : null;
  if (page) reportJobStep("Oyuncu verisi alınıyor");
  const playerFacts = page ? await loadPlayerStatsFacts(input.raw, new Date()) : null;
  if (page && !playerFacts) return { error: "Oyuncu istatistikleri alınamadı — kart üretilmedi." };
  const plan = playerPagePlan(page !== null, playerFacts?.settlement ?? null, data.playerPageMode);

  const mvp = (data.mvpId ? facts.players.find((player) => player.playerId === data.mvpId) : null) ?? facts.mvp;
  const result = await createMatchResultCard({
    facts,
    format: data.format,
    template: data.template,
    photo,
    mvp,
    photoIsMvp: data.photoIsMvp,
    offset: { x: data.offsetX, y: data.offsetY },
    zoom: data.zoom,
    stats,
    player: plan.action === "RENDER" && page && playerFacts ? { facts: playerFacts, template: page.template, count: page.count, provisional: plan.provisional } : null,
    pendingPlayerPage: plan.action === "DEFER" && page ? { template: page.template, count: page.count ?? null, playerId: mvp?.playerId ?? null } : null,
  });
  if (!result.ok) return { error: result.error.message };

  // İş istek bittikten sonra da sürebilir; önbellek tazeleme isteğe bağlı (sayfalar force-dynamic).
  try {
    refreshDashboard();
  } catch {
    // istek kapsamı kapanmış — sorun değil
  }
  return { result: result.data };
}

/**
 * Kırpma önizlemesi — kart ÜRETMEZ, kayıt açmaz: fotoğraf hattının sonucu (tonlanmış kırpma) +
 * yazısız bölge çerçevesi. Kaynak küçükse AI büyütme burada yapılır ve önbelleğe girer; üretim
 * aynı fotoğrafı ikinci kez ücretlendirmez. Arka plan işi (büyütme 120 sn'ye kadar sürebilir).
 */
export async function previewMatchPhotoAction(_prevState: MatchPhotoPreviewState, formData: FormData): Promise<MatchPhotoPreviewState> {
  if (!(await getCurrentSession())) return { error: UNAUTHORIZED_MESSAGE };
  const job = startStudioJob<MatchPhotoPreviewState>({
    kind: "match-photo-preview",
    key: `match-photo-preview:${text(formData, "fixtureId")}:${text(formData, "format")}:${text(formData, "template")}`,
    firstStep: "Maç verisi alınıyor",
    run: () => previewMatchPhoto(formData),
    fail: (message) => ({ error: message }),
  });
  return { job };
}

async function previewMatchPhoto(formData: FormData): Promise<MatchPhotoPreviewState> {
  const input = await resolveInput(formData);
  if (!input.ok) return { error: input.error };
  const { data, facts, photo } = input;

  const frame = MATCH_DAY_FRAMES[data.format];
  reportJobStep("Yüz tespiti ve kırpma");
  const prepared = await prepareMatchPhoto({
    image: photo.image,
    frame,
    accentHex: resultAccentHex(facts),
    deepHex: COMPETITION_COLORS[facts.competition.kind]?.deep,
    template: data.template,
    offset: { x: data.offsetX, y: data.offsetY },
    zoom: data.zoom,
  });
  if (!prepared.ok) return { error: prepared.error.message };
  const { art, crop, side, faces, quality } = prepared.data;

  const safe = matchResultGeometry(frame, side, data.template).photoSafe;
  const frameSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${frame.width}" height="${frame.height}"><rect x="${safe.left}" y="${safe.top}" width="${safe.right - safe.left}" height="${safe.bottom - safe.top}" fill="none" stroke="#ffd400" stroke-width="4" stroke-dasharray="18 12"/></svg>`;
  const jpeg = await sharp(art).composite([{ input: Buffer.from(frameSvg) }]).resize({ width: 540 }).jpeg({ quality: 78 }).toBuffer();
  return {
    preview: {
      imageDataUri: `data:image/jpeg;base64,${jpeg.toString("base64")}`,
      faces: faces.length,
      facesInSafe: crop.facesInSafe,
      zoom: crop.zoom,
      side,
      sharpness: Math.round(quality.sharpness),
      upscaled: quality.upscaled,
      paidCalls: quality.paidCalls,
      warnings: quality.warnings,
    },
  };
}
