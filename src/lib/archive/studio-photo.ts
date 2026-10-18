import { resolveStudioImage, type ResolvedImage } from "@/lib/dashboard/studio-image-input";
import { getFixtureById, parseFixtureId } from "@/lib/services/api-football";
import type { Result } from "@/types/result";
import { resolveArchivePhoto } from "./picker-input";

/**
 * Maç bağlamlı stüdyoların (Maç Günü, Muhtemel Kadro, Market Analizi, genel stüdyo) ortak fotoğraf
 * çözücüsü. Takım kimlikleri formdan değil, sunucuda maçtan (`fixtureId` → API-Football) türetilir;
 * seçilen/yüklenen fotoğraf o maçın takımlarından birine ait olmalıdır (`resolveArchivePhoto`).
 * Eski kütüphane alanı (`<alan>AssetId`) bir sürüm boyunca okunmaya devam eder.
 */

export async function matchTeamIds(fixtureId: string): Promise<Result<number[]>> {
  const apiId = parseFixtureId(fixtureId);
  if (apiId === null) return { ok: false, error: { code: "INVALID_FIXTURE", message: "Fotoğraf için önce maçı seçin." } };
  const fixture = await getFixtureById(apiId);
  if (!fixture.ok) return { ok: false, error: { code: fixture.error.code, message: `Maç bilgisi alınamadı: ${fixture.error.message}` } };
  return { ok: true, data: [Number(fixture.data.homeTeam.id), Number(fixture.data.awayTeam.id)] };
}

export async function resolveStudioPhoto(
  formData: FormData,
  field: string,
  fixtureId: string,
  legacyLabel: string,
): Promise<Result<(ResolvedImage & { playerApiId: number | null }) | null>> {
  const assetId = formData.get(`${field}AssetId`);
  if (typeof assetId === "string" && assetId.length > 0) {
    const legacy = await resolveStudioImage(formData, field, "PLAYER", legacyLabel);
    return legacy.ok && legacy.data ? { ok: true, data: { ...legacy.data, playerApiId: null } } : legacy.ok ? { ok: true, data: null } : legacy;
  }
  const hasPick = formData.get(`${field}PhotoId`) || (formData.get(field) instanceof File && (formData.get(field) as File).size > 0);
  if (!hasPick) return { ok: true, data: null };
  const teams = await matchTeamIds(fixtureId);
  if (!teams.ok) return teams;
  const resolved = await resolveArchivePhoto(formData, field, teams.data, fixtureId);
  if (!resolved.ok) return resolved;
  return { ok: true, data: resolved.data ? { image: resolved.data.image, fileUrl: resolved.data.fileUrl, playerApiId: resolved.data.playerApiId } : null };
}
