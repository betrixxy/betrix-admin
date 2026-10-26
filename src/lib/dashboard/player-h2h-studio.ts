import { displayPersonName } from "@/lib/archive/names";
import { photoForCard, readUrl } from "@/lib/archive/storage";
import { domesticLeague } from "@/lib/archive/structure";
import { hasFace } from "@/lib/dashboard/player-h2h-photo";
import type { UploadedImage } from "@/lib/dashboard/studio-images";
import { playerKey } from "@/lib/player-h2h/keys";
import { goalContributionLeader } from "@/lib/player-h2h/leaders";
import { prisma } from "@/lib/prisma";
import { getFixtureById } from "@/lib/services/api-football/fixtures";
import { getTeamLeaguePlayers } from "@/lib/services/api-football/team-player-stats";
import { getTeamCurrentLeagues, getTeamInfo } from "@/lib/services/api-football/team-directory";
import type { Result } from "@/types/result";

/**
 * Oyuncu karşılaştırma stüdyosunun sunucu verisi (yalnızca okuma; fotoğraf büyütmesi ilk kart
 * kullanımında, arşivin kuralıyla). Oyuncular fotoğraf arşivinden (kadro senkronu) gelir; seçim
 * `<apiId>:<takımId>` anahtarıyla. Fotoğraf seçici YALNIZCA oyuncunun güncel takım formalı
 * fotoğraflarını gösterir; kart tarafı aynı kuralı sunucuda tekrar doğrular.
 */

export interface H2HPlayerOption {
  /** "<API-Football oyuncu kimliği>:<takım kimliği>" */
  key: string;
  playerId: number;
  teamId: number;
  name: string;
  teamName: string;
  position: string | null;
}

/** Arşivdeki bütün oyuncular (güncel takımıyla) — aramalı seçicinin listesi. */
export async function h2hPlayerOptions(): Promise<H2HPlayerOption[]> {
  const people = await prisma.person.findMany({
    where: { role: "PLAYER", currentTeamId: { not: null } },
    select: { apiId: true, officialName: true, nameOverride: true, position: true, currentTeam: { select: { id: true, officialName: true } } },
  });
  return people.flatMap((person) =>
    person.currentTeam ? [{ key: playerKey(person.apiId, person.currentTeam.id), playerId: person.apiId, teamId: person.currentTeam.id, name: displayPersonName(person), teamName: person.currentTeam.officialName, position: person.position }] : [],
  );
}

export interface H2HMatchContext {
  fixtureId: string;
  homeTeam: { id: number; name: string };
  awayTeam: { id: number; name: string };
  kickoffUtc: string;
  /** Takım başına öneri (gol + asist lideri); veri yoksa null. */
  suggestions: { home: string | null; away: string | null };
  warnings: string[];
}

/** Takımın yurt içi liginde gol + asist lideri → arşivdeki oyuncu anahtarı (arşivde yoksa null + uyarı). */
async function suggestFor(teamId: number, warnings: string[]): Promise<string | null> {
  const [info, leagues] = await Promise.all([getTeamInfo(teamId), getTeamCurrentLeagues(teamId)]);
  if (!info.ok || !leagues.ok) return null;
  const domestic = domesticLeague(leagues.data, info.data?.country ?? null);
  if (!domestic || domestic.season === null) return null;
  const players = await getTeamLeaguePlayers(teamId, domestic.season, domestic.id);
  if (!players.ok) return null;
  const leader = goalContributionLeader(players.data, teamId, domestic.id);
  if (!leader) return null;
  const inArchive = await prisma.person.findFirst({ where: { apiId: leader.playerId, role: "PLAYER", currentTeamId: teamId }, select: { apiId: true } });
  if (!inArchive) {
    warnings.push(`${leader.name} (gol + asist lideri) arşivde yok — elle seçin ya da kadroyu senkronlayın`);
    return null;
  }
  return playerKey(leader.playerId, teamId);
}

export async function h2hMatchContext(fixtureId: string, apiId: number): Promise<Result<H2HMatchContext>> {
  const fixture = await getFixtureById(apiId);
  if (!fixture.ok) return { ok: false, error: { code: fixture.error.code, message: fixture.error.message } };
  const { homeTeam, awayTeam, kickoffUtc } = fixture.data;
  const warnings: string[] = [];
  const [home, away] = await Promise.all([suggestFor(Number(homeTeam.id), warnings), suggestFor(Number(awayTeam.id), warnings)]);
  return {
    ok: true,
    data: { fixtureId, homeTeam: { id: Number(homeTeam.id), name: homeTeam.name }, awayTeam: { id: Number(awayTeam.id), name: awayTeam.name }, kickoffUtc, suggestions: { home, away }, warnings },
  };
}

export interface H2HPhotoOption {
  id: string;
  url: string;
  width: number;
  height: number;
  caption: string;
}

/** Oyuncunun GÜNCEL takım formalı arşiv fotoğrafları (en yeni önce). */
export async function playerKitPhotos(playerId: number, teamId: number): Promise<H2HPhotoOption[]> {
  const photos = await prisma.photo.findMany({
    where: { hiddenAt: null, kitTeamId: teamId, person: { apiId: playerId, role: "PLAYER" } },
    orderBy: { uploadedAt: "desc" },
    select: { id: true, originalUrl: true, width: true, height: true, caption: true },
  });
  return photos.map((photo) => ({ id: photo.id, url: photo.originalUrl, width: photo.width, height: photo.height, caption: photo.caption }));
}

/** Fotoğrafta yüz var mı (orijinal dosyadan; büyütme tetiklenmez). */
export async function photoHasFace(photoId: string): Promise<Result<boolean>> {
  const photo = await prisma.photo.findUnique({ where: { id: photoId }, select: { originalUrl: true } });
  if (!photo) return { ok: false, error: { code: "PHOTO_NOT_FOUND", message: "Fotoğraf bulunamadı." } };
  const image = await readUrl(photo.originalUrl, "Arşiv fotoğrafı");
  if (!image.ok) return image;
  return { ok: true, data: await hasFace(image.data) };
}

/**
 * Kartın fotoğrafı: formdan gelen kimliğe güvenilmez — fotoğraf bu oyuncunun ve forması güncel takımının
 * olmalı. Kart için büyütülmüş sürüm (yoksa ilk kullanımda büyütülür, kayda yazılır).
 */
export async function resolveH2HPhoto(photoId: string, playerId: number, teamId: number): Promise<Result<{ image: UploadedImage; photoId: string }>> {
  const photo = await prisma.photo.findUnique({ where: { id: photoId }, include: { person: { select: { apiId: true, role: true } } } });
  if (!photo || photo.hiddenAt) return { ok: false, error: { code: "PHOTO_NOT_FOUND", message: "Seçilen arşiv fotoğrafı bulunamadı." } };
  if (photo.person?.apiId !== playerId || photo.person.role !== "PLAYER") return { ok: false, error: { code: "PHOTO_NOT_PLAYER", message: "Seçilen fotoğraf bu oyuncunun değil." } };
  if (photo.kitTeamId !== teamId) return { ok: false, error: { code: "KIT_MISMATCH", message: "Fotoğraftaki forma oyuncunun güncel takımının değil." } };
  const card = await photoForCard(photo, async (url) => {
    await prisma.photo.update({ where: { id: photo.id }, data: { upscaledUrl: url } });
  });
  if (!card.ok) return card;
  return { ok: true, data: { image: card.data.image, photoId: photo.id } };
}
