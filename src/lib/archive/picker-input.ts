import { z } from "zod";
import { inspectImageUpload, type UploadedImage } from "@/lib/dashboard/studio-images";
import { prisma } from "@/lib/prisma";
import { PHOTO_KINDS } from "@/types/archive";
import type { Result } from "@/types/result";
import { createArchivePhoto } from "./mutations";
import { kitTeamOf } from "./picker-order";
import { photoForCard } from "./storage";

/**
 * Stüdyo formundaki arşiv seçicisinin (`ArchivePhotoPicker`) sunucu çözücüsü. Alanlar `<ad>` öneki
 * taşır: `<ad>PhotoId` (arşivden seçilen) ya da `<ad>` dosyası + `<ad>Subject` ("team:<id>" |
 * "person:<id>") + `<ad>Kind` + `<ad>Caption` + `<ad>KitTeamId` (yeni yükleme → doğru klasöre).
 * Formdan gelen kimliklere güvenilmez: fotoğraf/kişi gerçekten maçtaki takımlardan birine ait olmalı.
 * Kart için büyütülmüş sürüm döner (yoksa ilk kullanımda büyütülür, kayda yazılır).
 */

export interface ResolvedArchivePhoto {
  image: UploadedImage;
  /** Kartın okuduğu dosya (büyütülmüş ya da orijinal). */
  fileUrl: string;
  photoId: string;
  /** Fotoğraftaki kişinin API-Football kimliği (oyuncuysa) — "MAÇIN OYUNCUSU" kuralı. */
  playerApiId: number | null;
  teamId: number;
}

type Fail = { ok: false; error: { code: string; message: string } };
const fail = (code: string, message: string): Fail => ({ ok: false, error: { code, message } });
const KIT_MISMATCH_MESSAGE = "Fotoğraftaki forma bu takımın değil — posterin bu yarısına yalnızca takımın kendi formalı fotoğrafı girer.";

function text(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

async function forCard(photo: { id: string; originalUrl: string; upscaledUrl: string | null }) {
  return photoForCard(photo, async (url) => {
    await prisma.photo.update({ where: { id: photo.id }, data: { upscaledUrl: url } });
  });
}

/** Kişi maçtaki takımlardan birinin (kulüp ya da milli) kadrosunda mı. */
function memberOf(person: { currentTeamId: number | null; nationalTeamId: number | null }, teamIds: readonly number[]): number | null {
  return teamIds.find((id) => id === person.currentTeamId || id === person.nationalTeamId) ?? null;
}

/**
 * `null` → bu alan için seçim/yükleme yok (çağıran eski akışa ya da "fotoğraf yok" hatasına düşer).
 * `fixtureId`: yeni yükleme bu maçın etiketiyle arşive girer.
 */
export async function resolveArchivePhoto(
  formData: FormData,
  field: string,
  teamIds: readonly number[],
  fixtureId: string | null,
  /** Yalnızca forması o takımın olan fotoğraf (vitrin posteri); seçilen ya da yüklenen. */
  options: { kitOnly?: boolean } = {},
): Promise<Result<ResolvedArchivePhoto | null>> {
  const photoId = text(formData, `${field}PhotoId`);
  if (photoId) {
    const photo = await prisma.photo.findUnique({ where: { id: photoId }, include: { person: { select: { apiId: true, role: true, currentTeamId: true, nationalTeamId: true } } } });
    if (!photo || photo.hiddenAt) return fail("PHOTO_NOT_FOUND", "Seçilen arşiv fotoğrafı bulunamadı.");
    const teamId = photo.person ? memberOf(photo.person, teamIds) : teamIds.includes(photo.teamId) ? photo.teamId : null;
    if (teamId === null) return fail("PHOTO_NOT_FOR_MATCH", "Seçilen fotoğraf bu maçtaki takımlara ait değil.");
    if (options.kitOnly && kitTeamOf(photo) !== teamId) return fail("KIT_MISMATCH", KIT_MISMATCH_MESSAGE);
    const card = await forCard(photo);
    if (!card.ok) return card;
    return { ok: true, data: { image: card.data.image, fileUrl: card.data.url, photoId: photo.id, playerApiId: photo.person?.role === "PLAYER" ? photo.person.apiId : null, teamId } };
  }

  const file = formData.get(field);
  if (!(file instanceof File) || file.size === 0) return { ok: true, data: null };

  const subject = text(formData, `${field}Subject`);
  let teamId: number | null = null;
  let personId: string | null = null;
  let playerApiId: number | null = null;
  const teamMatch = /^team:(\d+)$/.exec(subject);
  const personMatch = /^person:(.+)$/.exec(subject);
  if (teamMatch) {
    teamId = Number(teamMatch[1]);
    if (!teamIds.includes(teamId)) return fail("SUBJECT_NOT_IN_MATCH", "Seçilen takım bu maçta değil.");
  } else if (personMatch?.[1]) {
    const person = await prisma.person.findUnique({ where: { id: personMatch[1] } });
    teamId = person ? memberOf(person, teamIds) : null;
    if (!person || teamId === null) return fail("SUBJECT_NOT_IN_MATCH", "Fotoğraftaki kişi bu maçtaki takımların kadrosunda değil.");
    personId = person.id;
    playerApiId = person.role === "PLAYER" ? person.apiId : null;
  } else {
    return fail("SUBJECT_MISSING", "Yeni fotoğraf için \"Fotoğraftaki kişi\"yi seçin (takım fotoğrafı da olabilir).");
  }

  const kind = z.enum(PHOTO_KINDS).safeParse(text(formData, `${field}Kind`) || "CELEBRATION");
  const kitTeamId = Number(text(formData, `${field}KitTeamId`)) || teamId;
  if (options.kitOnly && kitTeamId !== teamId) return fail("KIT_MISMATCH", KIT_MISMATCH_MESSAGE);
  if (!(await prisma.team.findUnique({ where: { id: kitTeamId }, select: { id: true } }))) return fail("KIT_TEAM_UNKNOWN", "Forma takımı arşivde yok.");
  const inspected = await inspectImageUpload(file, "Fotoğraf");
  if (!inspected.ok) return inspected;
  const created = await createArchivePhoto({
    image: inspected.data,
    teamId,
    personId,
    kitTeamId,
    fixtureId,
    kind: kind.success ? kind.data : "CELEBRATION",
    caption: text(formData, `${field}Caption`).slice(0, 300),
    credit: "",
  });
  // Aynı fotoğraf bu klasörde zaten varsa onu kullan (tekrar yükleme hata değil).
  const existing = created.ok ? null : await prisma.photo.findFirst({ where: { sha256: inspected.data.hash, personId, teamId }, select: { id: true } });
  const id = created.ok ? created.data.id : existing?.id;
  if (!id) return created.ok ? fail("STORAGE_FAILED", "Fotoğraf arşive kaydedilemedi.") : created;
  const photo = await prisma.photo.findUniqueOrThrow({ where: { id }, select: { id: true, originalUrl: true, upscaledUrl: true } });
  const card = await forCard(photo);
  if (!card.ok) return card;
  return { ok: true, data: { image: card.data.image, fileUrl: card.data.url, photoId: photo.id, playerApiId, teamId } };
}

