"use server";

import { z } from "zod";
import { getCurrentSession } from "@/lib/auth/require-session";
import { createArchivePhoto, hideArchivePhoto, renamePerson, resolvePendingTransfer, tagLegacyAsset, transferPerson, updateArchivePhoto } from "@/lib/archive/mutations";
import { syncLeague, syncTeam } from "@/lib/archive/sync";
import { refreshDashboard, UNAUTHORIZED_MESSAGE } from "@/lib/dashboard/action-utils";
import { inspectImageUpload } from "@/lib/dashboard/studio-images";
import { prisma } from "@/lib/prisma";
import { PHOTO_KINDS, type ArchiveActionState } from "@/types/archive";

/**
 * Fotoğraf arşivi işlemleri. Klasör yeri formdan gelen takım/kişi kimliğiyle belirlenir ve her
 * ikisi sunucuda doğrulanır (kişi gerçekten o takımın — kulüp ya da milli — kadrosunda mı).
 */

const teamId = z.coerce.number().int().positive("Takım seçin.");
const optionalPersonId = z.string().trim().transform((value) => value || null);
/** Maç etiketi: "1584435" ya da "api-football-1584435"; boş = maç fotoğrafı değil. */
const fixtureId = z
  .string()
  .trim()
  .regex(/^((api-football-)?\d+)?$/, "Maç kimliği rakam olmalı (API-Football fixture id).")
  .transform((value) => (value ? `api-football-${value.replace(/^api-football-/, "")}` : null));
const kind = z.enum(PHOTO_KINDS, "Fotoğraf türünü seçin.");
const text = (max: number) => z.string().trim().max(max);

function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

const fields = (formData: FormData, names: readonly string[]) => Object.fromEntries(names.map((name) => [name, field(formData, name)]));

async function guard(): Promise<ArchiveActionState | null> {
  return (await getCurrentSession()) ? null : { error: UNAUTHORIZED_MESSAGE };
}

/** Kişi verilmişse bu takımın kulüp ya da milli kadrosunda olmalı. */
async function personBelongs(personId: string | null, team: number): Promise<boolean> {
  if (!personId) return true;
  const person = await prisma.person.findUnique({ where: { id: personId }, select: { currentTeamId: true, nationalTeamId: true } });
  return !!person && (person.currentTeamId === team || person.nationalTeamId === team);
}

const uploadSchema = z.object({ teamId, personId: optionalPersonId, kitTeamId: teamId, fixtureId, kind, caption: text(300), credit: text(120) });

export async function uploadArchivePhotoAction(_prev: ArchiveActionState, formData: FormData): Promise<ArchiveActionState> {
  const denied = await guard();
  if (denied) return denied;
  const parsed = uploadSchema.safeParse(fields(formData, ["teamId", "personId", "kitTeamId", "fixtureId", "kind", "caption", "credit"]));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Geçersiz form verisi." };
  const data = parsed.data;
  if (!(await personBelongs(data.personId, data.teamId))) return { error: "Seçilen kişi bu takımın kadrosunda değil." };
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Bir fotoğraf seçin." };
  const image = await inspectImageUpload(file, "Fotoğraf");
  if (!image.ok) return { error: image.error.message };

  const created = await createArchivePhoto({ image: image.data, ...data });
  if (!created.ok) return { error: created.error.message };
  refreshDashboard();
  const upscaleNote = created.data.upscaled ? " Kart için kısa kenarı 2000'e büyütülmüş sürüm de hazır." : created.data.upscaleError ? ` Büyütme yapılamadı (${created.data.upscaleError}) — kartta ilk kullanımda tekrar denenecek.` : "";
  return { notice: `Fotoğraf arşive eklendi.${upscaleNote}` };
}

const editSchema = z.object({ photoId: z.string().min(1), caption: text(300), kind, kitTeamId: teamId, fixtureId });

export async function updateArchivePhotoAction(_prev: ArchiveActionState, formData: FormData): Promise<ArchiveActionState> {
  const denied = await guard();
  if (denied) return denied;
  const parsed = editSchema.safeParse(fields(formData, ["photoId", "caption", "kind", "kitTeamId", "fixtureId"]));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Geçersiz form verisi." };
  const { photoId, ...edit } = parsed.data;
  await updateArchivePhoto(photoId, edit);
  refreshDashboard();
  return { notice: "Kaydedildi." };
}

export async function hideArchivePhotoAction(photoId: string): Promise<ArchiveActionState> {
  const denied = await guard();
  if (denied) return denied;
  await hideArchivePhoto(photoId);
  refreshDashboard();
  return { notice: "Fotoğraf arşivden kaldırıldı (kullanılmış kartlar etkilenmez)." };
}

const renameSchema = z.object({ personId: z.string().min(1), nameOverride: text(120) });

export async function renamePersonAction(_prev: ArchiveActionState, formData: FormData): Promise<ArchiveActionState> {
  const denied = await guard();
  if (denied) return denied;
  const parsed = renameSchema.safeParse(fields(formData, ["personId", "nameOverride"]));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Geçersiz ad." };
  await renamePerson(parsed.data.personId, parsed.data.nameOverride || null);
  refreshDashboard();
  return { notice: parsed.data.nameOverride ? "Resmi ad düzeltildi." : "Düzeltme kaldırıldı — API'den türetilen ad kullanılıyor." };
}

const transferSchema = z.object({ personId: z.string().min(1), teamId });

export async function transferPersonAction(_prev: ArchiveActionState, formData: FormData): Promise<ArchiveActionState> {
  const denied = await guard();
  if (denied) return denied;
  const parsed = transferSchema.safeParse(fields(formData, ["personId", "teamId"]));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Takım seçin." };
  const result = await transferPerson(parsed.data.personId, parsed.data.teamId);
  if (!result.ok) return { error: result.error.message };
  refreshDashboard();
  return { notice: `Takımı değişti; ${result.data.moved} fotoğrafın klasörü taşındı (formaları aynı kaldı).` };
}

export async function resolveTransferAction(personId: string, accept: boolean): Promise<ArchiveActionState> {
  const denied = await guard();
  if (denied) return denied;
  const result = await resolvePendingTransfer(personId, accept);
  if (!result.ok) return { error: result.error.message };
  refreshDashboard();
  return { notice: accept ? `Taşındı; ${result.data.moved} fotoğrafın klasörü güncellendi.` : "Öneri yoksayıldı." };
}

const tagSchema = z.object({ assetId: z.string().min(1), teamId, personId: optionalPersonId, kitTeamId: teamId, kind, caption: text(300) });

export async function tagLegacyAssetAction(_prev: ArchiveActionState, formData: FormData): Promise<ArchiveActionState> {
  const denied = await guard();
  if (denied) return denied;
  const parsed = tagSchema.safeParse(fields(formData, ["assetId", "teamId", "personId", "kitTeamId", "kind", "caption"]));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Geçersiz form verisi." };
  const { assetId, ...tag } = parsed.data;
  if (!(await personBelongs(tag.personId, tag.teamId))) return { error: "Seçilen kişi bu takımın kadrosunda değil." };
  const result = await tagLegacyAsset(assetId, tag);
  if (!result.ok) return { error: result.error.message };
  refreshDashboard();
  return { notice: "Fotoğraf arşive alındı." };
}

/** Kadro senkronu (yalnızca API okuması): tek takım ya da Trendyol Süper Lig + 1. Lig. */
export async function syncArchiveAction(_prev: ArchiveActionState, formData: FormData): Promise<ArchiveActionState> {
  const denied = await guard();
  if (denied) return denied;
  const team = Number(field(formData, "teamId"));
  const force = field(formData, "force") === "on";
  if (Number.isInteger(team) && team > 0) {
    const result = await syncTeam(team, { force: true });
    if (!result.ok) return { error: result.error.message };
    refreshDashboard();
    return { notice: `Kadro güncellendi: ${result.data.peopleAdded} yeni, ${result.data.peopleUpdated} güncellenen kişi${result.data.suggestions.length ? `, ${result.data.suggestions.length} transfer önerisi` : ""}.` };
  }
  const reports = [await syncLeague(203, { force }), await syncLeague(204, { force })];
  const failed = reports.find((report) => !report.ok);
  if (failed && !failed.ok) return { error: failed.error.message };
  const total = reports.reduce((sum, report) => (report.ok ? { teams: sum.teams + report.data.teams, added: sum.added + report.data.peopleAdded, suggestions: sum.suggestions + report.data.suggestions.length } : sum), { teams: 0, added: 0, suggestions: 0 });
  refreshDashboard();
  return { notice: `Türk ligleri senkronlandı: ${total.teams} takım, ${total.added} yeni kişi, ${total.suggestions} transfer önerisi.` };
}
