import { resolveArchivePhoto } from "@/lib/archive/picker-input";
import { matchTeamIds } from "@/lib/archive/studio-photo";
import type { UploadedImage } from "@/lib/dashboard/studio-images";
import type { LineupTemplateStyle, TeamLineupDraft } from "@/types/lineup";
import type { Result } from "@/types/result";

/**
 * Kahraman Liste kapağının sunucu çözücüsü: formdaki `heroPhotoId`'ye güvenilmez — fotoğraf arşivde olmalı,
 * maçtaki O TARAFIN takımına ait olmalı ve forması o takımın olmalı (`kitOnly`, Vitrin posteri kuralı).
 * Kart için büyütülmüş sürüm döner. Şablon taktik tahtasıysa ya da fotoğraf seçilmediyse `null` (kapaksız).
 */
export async function resolveLineupHeroPhoto(
  fixtureId: string,
  side: "home" | "away",
  team: Pick<TeamLineupDraft, "heroPhotoId">,
  templateStyle: LineupTemplateStyle,
): Promise<Result<UploadedImage | null>> {
  if (templateStyle !== "hero_list" || !team.heroPhotoId) return { ok: true, data: null };
  const teams = await matchTeamIds(fixtureId);
  if (!teams.ok) return teams;
  const teamId = teams.data[side === "home" ? 0 : 1];
  if (teamId === undefined) return { ok: false, error: { code: "INVALID_FIXTURE", message: "Maçın takımları okunamadı." } };
  const form = new FormData();
  form.set("heroPhotoId", team.heroPhotoId);
  const resolved = await resolveArchivePhoto(form, "hero", [teamId], fixtureId, { kitOnly: true });
  if (!resolved.ok) return { ok: false, error: { code: resolved.error.code, message: `Kapak fotoğrafı: ${resolved.error.message}` } };
  return { ok: true, data: resolved.data?.image ?? null };
}
