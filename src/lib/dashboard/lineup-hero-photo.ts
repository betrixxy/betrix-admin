import { resolveArchivePhoto } from "@/lib/archive/picker-input";
import { matchTeamIds } from "@/lib/archive/studio-photo";
import { reportJobNote } from "@/lib/jobs/studio-jobs";
import { pickLineupHero, type HeroSelection } from "@/lib/dashboard/lineup-hero-pick";
import type { UploadedImage } from "@/lib/dashboard/studio-images";
import { prisma } from "@/lib/prisma";
import type { LineupTemplateStyle, TeamLineupDraft } from "@/types/lineup";
import type { Result } from "@/types/result";

/** Çözülen kapak: kartın görseli (yoksa yedek tasarım), gerçekte kullanılan arşiv fotoğrafı ve stüdyo notu. */
export interface LineupHero {
  image: UploadedImage | null;
  /** Kullanılan arşiv fotoğrafı — seçilenden farklıysa (11'den yedek) kayda bu yazılır; kapaksızsa "". */
  photoId: string;
  /** Kartı düşürmeyen geri dönüş notu (stüdyo + taslak ekranı) ya da null. */
  note: string | null;
}

const NO_HERO: LineupHero = { image: null, photoId: "", note: null };

/** Takımın 11'indeki oyuncuların en yeni, takımın KENDİ formalı (gizlenmemiş) arşiv fotoğrafı — oyuncu kimliğiyle. */
async function xiPhotos(teamId: number, playerIds: number[]): Promise<Map<number, string>> {
  if (playerIds.length === 0) return new Map();
  const photos = await prisma.photo.findMany({
    where: { hiddenAt: null, kitTeamId: teamId, kind: { not: "TEAM" }, person: { role: "PLAYER", apiId: { in: playerIds } } },
    orderBy: [{ takenAt: { sort: "desc", nulls: "last" } }, { uploadedAt: "desc" }],
    select: { id: true, person: { select: { apiId: true } } },
  });
  const byPlayer = new Map<number, string>();
  for (const photo of photos) if (photo.person && !byPlayer.has(photo.person.apiId)) byPlayer.set(photo.person.apiId, photo.id);
  return byPlayer;
}

async function selectedHero(photoId: string): Promise<HeroSelection | null> {
  if (!photoId) return null;
  const photo = await prisma.photo.findUnique({ where: { id: photoId }, select: { person: { select: { apiId: true, role: true, apiName: true, officialName: true, nameOverride: true } } } });
  const person = photo?.person ?? null;
  return { photoId, playerApiId: person?.role === "PLAYER" ? person.apiId : null, personName: person ? (person.nameOverride ?? person.officialName) || person.apiName : null };
}

/**
 * Kahraman Liste kapağının sunucu çözücüsü: formdaki `heroPhotoId`'ye güvenilmez — fotoğraf arşivde olmalı,
 * maçtaki O TARAFIN takımına ait olmalı ve forması o takımın olmalı (`kitOnly`, Vitrin posteri kuralı).
 * Kapak oyuncusu kartın 11'inde olmalı; değilse 11'de takım formalı fotoğrafı olan bir oyuncu, o da yoksa yedek
 * tasarım (`lineup-hero-pick.ts`). Kart için büyütülmüş sürüm döner. Şablon taktik tahtasıysa kapak yok.
 */
export async function resolveLineupHeroPhoto(
  fixtureId: string,
  side: "home" | "away",
  team: Pick<TeamLineupDraft, "heroPhotoId" | "slots" | "teamName">,
  templateStyle: LineupTemplateStyle,
): Promise<Result<LineupHero>> {
  if (templateStyle !== "hero_list") return { ok: true, data: NO_HERO };
  const teams = await matchTeamIds(fixtureId);
  if (!teams.ok) return teams;
  const teamId = teams.data[side === "home" ? 0 : 1];
  if (teamId === undefined) return { ok: false, error: { code: "INVALID_FIXTURE", message: "Maçın takımları okunamadı." } };

  const xiIds = team.slots.flatMap((slot) => (slot.playerId !== null ? [slot.playerId] : []));
  const [selected, photoByPlayer] = await Promise.all([selectedHero(team.heroPhotoId), xiPhotos(teamId, xiIds)]);
  const pick = pickLineupHero({ teamName: team.teamName, slots: team.slots, selected, photoByPlayer });
  // Kaydın `renderOptions.studioNotes`una (taslak ekranı) — önizleme notu sonuçla da döner.
  if (pick.note) reportJobNote(pick.note);
  if (pick.kind === "fallback") return { ok: true, data: { ...NO_HERO, note: pick.note } };

  const form = new FormData();
  form.set("heroPhotoId", pick.photoId);
  const resolved = await resolveArchivePhoto(form, "hero", [teamId], fixtureId, { kitOnly: true });
  if (!resolved.ok) return { ok: false, error: { code: resolved.error.code, message: `Kapak fotoğrafı: ${resolved.error.message}` } };
  return { ok: true, data: { image: resolved.data?.image ?? null, photoId: pick.photoId, note: pick.note } };
}
