"use server";

import sharp from "sharp";
import { z } from "zod";
import { getCurrentSession } from "@/lib/auth/require-session";
import { refreshDashboard, UNAUTHORIZED_MESSAGE } from "@/lib/dashboard/action-utils";
import { MATCH_DAY_FRAMES } from "@/lib/dashboard/match-day-formats";
import { prepareMatchPhoto } from "@/lib/dashboard/match-photo";
import { loadMediaAssetImage, matchPhotoTag } from "@/lib/dashboard/media-library";
import { createMatchResultCard, type MatchPhotoInput } from "@/lib/dashboard/match-result-engine";
import { validateMatchResultFixture } from "@/lib/dashboard/match-result-studio";
import { COMPETITION_COLORS, resultAccentHex } from "@/lib/dashboard/match-result-theme";
import { resolveStudioImage } from "@/lib/dashboard/studio-image-input";
import { getMatchResultRaw, parseFixtureId } from "@/lib/services/api-football";
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
  photoPlayerId: optionalPlayerId,
  offsetX: offset,
  offsetY: offset,
  zoom,
});

const cardSchema = photoSchema.extend({ mvpId: optionalPlayerId, photoIsMvp: z.boolean() });

const FIELDS = ["fixtureId", "template", "format", "photoPlayerId", "offsetX", "offsetY", "zoom", "mvpId"] as const;

function text(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

type Fail = { ok: false; error: string };

/** Form → doğrulanmış alanlar + maç (sunucuda yeniden çekilir) + maç fotoğrafı. */
async function resolveInput(formData: FormData): Promise<
  | { ok: true; data: z.infer<typeof cardSchema>; facts: MatchResultFacts; photo: MatchPhotoInput }
  | Fail
> {
  const parsed = cardSchema.safeParse({ ...Object.fromEntries(FIELDS.map((name) => [name, text(formData, name)])), photoIsMvp: formData.get("photoIsMvp") === "on" });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Geçersiz form verisi." };
  const data = parsed.data;

  const apiId = parseFixtureId(data.fixtureId);
  const raw = apiId ? await getMatchResultRaw(apiId) : null;
  if (!raw?.ok) return { ok: false, error: `Maç verisi alınamadı: ${raw?.error.message ?? "geçersiz maç kimliği"}` };
  const validated = validateMatchResultFixture(raw.data, new Date());
  if (!validated.ok) return { ok: false, error: validated.error.message };
  const facts = validated.data;

  const photo = await resolvePhoto(formData, data, facts);
  return photo.ok ? { ok: true, data, facts, photo: photo.data } : { ok: false, error: photo.error.message };
}

/**
 * Maç fotoğrafı: kütüphaneden seçilen (`photoAssetId`) gerçekten BU maçın fotoğrafı olmalı (form
 * kimliğine güvenilmez); yoksa yeni yükleme (`photo`) maç + isteğe bağlı oyuncu etiketiyle
 * kütüphaneye kaydedilir — bir sonraki açılışta listede gelir. Fotoğraf yoksa kart üretilmez.
 */
async function resolvePhoto(formData: FormData, data: z.infer<typeof photoSchema>, facts: MatchResultFacts): Promise<Result<MatchPhotoInput>> {
  const assetId = text(formData, "photoAssetId");
  if (assetId) {
    const tag = await matchPhotoTag(assetId, data.fixtureId);
    if (!tag) return { ok: false, error: { code: "PHOTO_NOT_FOR_MATCH", message: "Seçilen kütüphane fotoğrafı bu maça ait değil." } };
    const loaded = await loadMediaAssetImage(assetId, "MATCH_PHOTO");
    return loaded.ok ? { ok: true, data: { image: loaded.data.image, fileUrl: loaded.data.fileUrl, playerId: tag.playerId } } : loaded;
  }

  const player = data.photoPlayerId ? facts.players.find((candidate) => candidate.playerId === data.photoPlayerId) : undefined;
  if (data.photoPlayerId && !player) return { ok: false, error: { code: "PLAYER_NOT_IN_MATCH", message: "Fotoğraf etiketi: seçilen oyuncu bu maçın kadrosunda değil." } };
  try {
    const resolved = await resolveStudioImage(formData, "photo", "MATCH_PHOTO", `${facts.home.name}-${facts.away.name} maç fotoğrafı`, {
      fixtureId: data.fixtureId,
      playerId: player?.playerId ?? null,
      playerName: player?.name ?? null,
    });
    if (!resolved.ok) return resolved;
    if (!resolved.data) return { ok: false, error: { code: "PHOTO_MISSING", message: "Maç fotoğrafı yok — kütüphaneden seçin ya da yükleyin. Kart üretilmedi." } };
    return { ok: true, data: { image: resolved.data.image, fileUrl: resolved.data.fileUrl, playerId: player?.playerId ?? null } };
  } catch {
    return { ok: false, error: { code: "LIBRARY_FAILED", message: "Maç fotoğrafı medya kütüphanesine kaydedilemedi." } };
  }
}

/** "Maç Sonucu" kartı: form → doğrulama → maç → fotoğraf → motor (kalite + yerleşim kapıları). DRAFT doğar. */
export async function generateMatchResultAction(_prevState: MatchResultActionState, formData: FormData): Promise<MatchResultActionState> {
  if (!(await getCurrentSession())) return { error: UNAUTHORIZED_MESSAGE };
  const input = await resolveInput(formData);
  if (!input.ok) return { error: input.error };
  const { data, facts, photo } = input;

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
  });
  if (!result.ok) return { error: result.error.message };

  refreshDashboard();
  return { result: result.data };
}

/**
 * Kırpma önizlemesi — kart ÜRETMEZ, kayıt açmaz: fotoğraf hattının sonucu (tonlanmış kırpma) +
 * yazısız bölge çerçevesi. Kaynak küçükse AI büyütme burada yapılır ve önbelleğe girer; üretim
 * aynı fotoğrafı ikinci kez ücretlendirmez.
 */
export async function previewMatchPhotoAction(_prevState: MatchPhotoPreviewState, formData: FormData): Promise<MatchPhotoPreviewState> {
  if (!(await getCurrentSession())) return { error: UNAUTHORIZED_MESSAGE };
  const input = await resolveInput(formData);
  if (!input.ok) return { error: input.error };
  const { data, facts, photo } = input;

  const frame = MATCH_DAY_FRAMES[data.format];
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
