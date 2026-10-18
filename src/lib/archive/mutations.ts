import type { PhotoKind } from "@/generated/prisma/client";
import type { UploadedImage } from "@/lib/dashboard/studio-images";
import type { PhotoUpscaler } from "@/lib/dashboard/match-photo/quality";
import { prisma } from "@/lib/prisma";
import type { Result } from "@/types/result";
import { displayPersonName, manualPersonName, officialPersonName } from "./names";
import { createArchiveUpscale, storeArchiveOriginal } from "./storage";
import { planTransfer } from "./transfer";

/**
 * Arşive yazan işlemler (sunucu). Klasör yeri her zaman etiketlerden türetilir — serbest klasör
 * adı yok. Silme = arşivden gizleme (`hiddenAt`): dosya ve onu kullanan kartlar bozulmaz.
 */

type Fail = { ok: false; error: { code: string; message: string } };
const fail = (code: string, message: string): Fail => ({ ok: false, error: { code, message } });

export interface NewArchivePhoto {
  image: UploadedImage;
  teamId: number;
  personId: string | null;
  kitTeamId: number;
  fixtureId: string | null;
  kind: PhotoKind;
  caption: string;
  credit: string;
}

/**
 * Yeni fotoğraf: orijinal bayt olduğu gibi + (kısa kenar < 2000) büyütülmüş sürüm — tek Fal
 * çağrısı, kaynak SHA-256 ile önbellekli. Büyütme düşerse fotoğraf yine kaydedilir; büyütme kartta
 * ilk kullanımda tekrar denenir.
 */
export async function createArchivePhoto(input: NewArchivePhoto, upscale?: PhotoUpscaler): Promise<Result<{ id: string; upscaled: boolean; upscaleError: string | null }>> {
  const duplicate = await prisma.photo.findFirst({ where: { sha256: input.image.hash, personId: input.personId, teamId: input.teamId }, select: { id: true, hiddenAt: true } });
  if (duplicate && !duplicate.hiddenAt) return fail("DUPLICATE", "Bu fotoğraf bu klasörde zaten var.");
  if (duplicate) {
    await prisma.photo.update({ where: { id: duplicate.id }, data: { hiddenAt: null } });
    return { ok: true, data: { id: duplicate.id, upscaled: false, upscaleError: null } };
  }
  const originalUrl = await storeArchiveOriginal(input.image);
  const upscaled = await createArchiveUpscale(input.image, upscale);
  const row = await prisma.photo.create({
    data: {
      personId: input.personId,
      teamId: input.teamId,
      kitTeamId: input.kitTeamId,
      fixtureId: input.fixtureId,
      kind: input.kind,
      caption: input.caption,
      credit: input.credit,
      originalUrl,
      upscaledUrl: upscaled.ok ? upscaled.data : null,
      sha256: input.image.hash,
      contentType: input.image.contentType,
      width: input.image.width,
      height: input.image.height,
      sizeBytes: input.image.bytes.length,
    },
    select: { id: true },
  });
  return { ok: true, data: { id: row.id, upscaled: upscaled.ok && upscaled.data !== null, upscaleError: upscaled.ok ? null : upscaled.error.message } };
}

export interface PhotoEdit {
  caption: string;
  kind: PhotoKind;
  kitTeamId: number;
  fixtureId: string | null;
}

export async function updateArchivePhoto(id: string, edit: PhotoEdit): Promise<void> {
  await prisma.photo.update({ where: { id }, data: edit });
}

/** Arşivden sil = gizle. Dosya silinmez; kartlar (AiContent) aynı dosyayı göstermeye devam eder. */
export async function hideArchivePhoto(id: string): Promise<void> {
  await prisma.photo.update({ where: { id }, data: { hiddenAt: new Date() } });
}

/** "Resmi adı düzelt" — boş bırakılırsa düzeltme kaldırılır (API'den türetilen ad döner). */
export async function renamePerson(id: string, override: string | null): Promise<void> {
  await prisma.person.update({ where: { id }, data: { nameOverride: override?.trim() || null } });
}

/**
 * Takım değişikliği (elle "Takımını değiştir" ya da önerinin onayı): kişinin kulübü yeni takım,
 * eski kulüp klasöründeki fotoğrafları yeni klasöre geçer, formaları (`kitTeamId`) aynı kalır.
 */
export async function transferPerson(personId: string, newTeamId: number): Promise<Result<{ moved: number }>> {
  const person = await prisma.person.findUnique({ where: { id: personId }, select: { currentTeamId: true } });
  if (!person) return fail("NOT_FOUND", "Kişi bulunamadı.");
  if (!(await prisma.team.findUnique({ where: { id: newTeamId }, select: { id: true } }))) return fail("NOT_FOUND", "Takım arşivde yok.");
  const photos = await prisma.photo.findMany({ where: { personId }, select: { id: true, teamId: true, kitTeamId: true } });
  const plan = planTransfer(photos, person.currentTeamId, newTeamId);
  await prisma.$transaction([
    prisma.person.update({ where: { id: personId }, data: { currentTeamId: newTeamId, pendingTeamId: null } }),
    prisma.photo.updateMany({ where: { id: { in: plan.moveIds } }, data: { teamId: newTeamId } }),
  ]);
  return { ok: true, data: { moved: plan.moveIds.length } };
}

/** "Taşınsın mı?" önerisi: onayla → transfer; yoksay → öneri silinir (kişi yerinde kalır). */
export async function resolvePendingTransfer(personId: string, accept: boolean): Promise<Result<{ moved: number }>> {
  const person = await prisma.person.findUnique({ where: { id: personId }, select: { pendingTeamId: true } });
  if (!person?.pendingTeamId) return fail("NOT_FOUND", "Bekleyen öneri yok.");
  if (accept) return transferPerson(personId, person.pendingTeamId);
  await prisma.person.update({ where: { id: personId }, data: { pendingTeamId: null } });
  return { ok: true, data: { moved: 0 } };
}

export interface LegacyTag {
  teamId: number;
  personId: string | null;
  kitTeamId: number;
  kind: PhotoKind;
  caption: string;
}

/**
 * Etiket bekleyen eski kütüphane fotoğrafı → arşiv. Aynı dosya (`MediaAsset.fileUrl`), kopya yok,
 * eski kayıt silinmez (`legacyAssetId`). Fal çağrısı yok — kartta ilk kullanımda büyütülür.
 */
export async function tagLegacyAsset(assetId: string, tag: LegacyTag): Promise<Result<{ id: string }>> {
  const asset = await prisma.mediaAsset.findUnique({ where: { id: assetId } });
  if (!asset || (asset.category !== "PLAYER" && asset.category !== "MATCH_PHOTO")) return fail("NOT_FOUND", "Eski fotoğraf bulunamadı.");
  if (await prisma.photo.findUnique({ where: { legacyAssetId: assetId }, select: { id: true } })) return fail("DUPLICATE", "Bu fotoğraf zaten arşive alınmış.");
  const duplicate = await prisma.photo.findFirst({ where: { sha256: asset.sha256, personId: tag.personId, teamId: tag.teamId }, select: { id: true } });
  if (duplicate) return fail("DUPLICATE", "Aynı fotoğraf bu klasörde zaten var.");
  const row = await prisma.photo.create({
    data: {
      legacyAssetId: asset.id,
      personId: tag.personId,
      teamId: tag.teamId,
      kitTeamId: tag.kitTeamId,
      fixtureId: asset.fixtureId,
      kind: tag.kind,
      caption: tag.caption,
      originalUrl: asset.fileUrl,
      sha256: asset.sha256,
      contentType: asset.contentType,
      width: asset.width,
      height: asset.height,
      sizeBytes: asset.sizeBytes,
      uploadedAt: asset.createdAt,
    },
    select: { id: true },
  });
  return { ok: true, data: row };
}

/** Etiket bekleyen eski fotoğrafı arşive almadan gizle / geri getir (dosya ve eski kayıt yerinde kalır). */
export async function dismissLegacyAsset(assetId: string, dismissed: boolean): Promise<Result<{ id: string }>> {
  const asset = await prisma.mediaAsset.findUnique({ where: { id: assetId }, select: { id: true, category: true } });
  if (!asset || (asset.category !== "PLAYER" && asset.category !== "MATCH_PHOTO")) return fail("NOT_FOUND", "Eski fotoğraf bulunamadı.");
  await prisma.mediaAsset.update({ where: { id: assetId }, data: { archiveDismissedAt: dismissed ? new Date() : null } });
  return { ok: true, data: { id: assetId } };
}

export type CoachInput =
  | { source: "API"; apiId: number; apiName: string; firstname: string | null; lastname: string | null }
  | { source: "MANUAL"; name: string };

/**
 * Takıma teknik direktör ekle (admin kararı — doğrudan atanır, öneri değil). API'den seçilen kişi
 * `(apiId, COACH)` ile tekildir; başka takımdaysa bu takıma geçer. Elle eklenen kişi negatif kimlik
 * alır (`isManualPerson`), senkron ona dokunmaz. Milli takımda `nationalTeamId` yazılır.
 */
export async function addCoach(teamId: number, input: CoachInput): Promise<Result<{ id: string; name: string }>> {
  const team = await prisma.team.findUnique({ where: { id: teamId }, select: { national: true } });
  if (!team) return fail("NOT_FOUND", "Takım arşivde yok.");
  const membership = team.national ? { nationalTeamId: teamId } : { currentTeamId: teamId, pendingTeamId: null };

  if (input.source === "API") {
    const officialName = officialPersonName(input.apiName, input.firstname, input.lastname);
    const person = await prisma.person.upsert({
      where: { apiId_role: { apiId: input.apiId, role: "COACH" } },
      create: { apiId: input.apiId, role: "COACH", apiName: input.apiName, officialName, ...membership },
      update: { apiName: input.apiName, officialName, ...membership },
      select: { id: true, officialName: true, nameOverride: true },
    });
    return { ok: true, data: { id: person.id, name: displayPersonName(person) } };
  }

  const name = manualPersonName(input.name);
  if (!name) return fail("INVALID_NAME", "Tam ad yazın (en az 3 harf, kısaltma yok — ör. \"Vincenzo Italiano\").");
  const existing = await prisma.person.findFirst({ where: { role: "COACH", apiId: { lt: 0 }, officialName: name }, select: { id: true } });
  if (existing) {
    await prisma.person.update({ where: { id: existing.id }, data: membership });
    return { ok: true, data: { id: existing.id, name } };
  }
  const lowest = await prisma.person.aggregate({ where: { apiId: { lt: 0 } }, _min: { apiId: true } });
  const apiId = Math.min(lowest._min.apiId ?? 0, 0) - 1;
  const person = await prisma.person.create({ data: { apiId, role: "COACH", apiName: name, officialName: name, ...membership }, select: { id: true } });
  return { ok: true, data: { id: person.id, name } };
}
