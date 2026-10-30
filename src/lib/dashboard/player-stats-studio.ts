import { photoForCard, readUrl } from "@/lib/archive/storage";
import { nameOrigin, type NameOrigin } from "@/lib/dashboard/name-case";
import { facePortrait } from "@/lib/dashboard/player-h2h-photo";
import type { PlayerNames } from "@/lib/dashboard/player-stats-card";
import type { UploadedImage } from "@/lib/dashboard/studio-images";
import { warmTeamColors } from "@/lib/dashboard/team-colors";
import { withTeamOrigins } from "@/lib/dashboard/team-origin";
import { resolvePlayerNames } from "@/lib/names/person-directory";
import { assemblePlayerStatsFacts } from "@/lib/player-stats/assemble";
import { fullNameFromApi } from "@/lib/player-h2h/names";
import { prisma } from "@/lib/prisma";
import { getPlayerProfile } from "@/lib/services/api-football/squads";
import type { ApiFootballFixtureResultRaw } from "@/lib/services/api-football/types";
import { getSportmonksPlayerLineups } from "@/lib/services/sportmonks/player-match";
import type { MatchSide, ResultTeam } from "@/types/match-result";
import type { PlayerMatchLine, PlayerStatsFacts } from "@/types/player-match-stats";

/**
 * Oyuncu İstatistikleri stüdyosunun sunucu verisi (yalnızca okuma; Fal yok — A'nın tam kadraj fotoğrafı
 * kart için büyütülmüş sürümü okur, arşivin "ilk kullanımda büyüt" kuralıyla):
 *   - maç + oyuncu satırları (API-Football) + xG (Sportmonks, dakika birebir tutuyorsa);
 *   - kart adları (arşiv düzeltmesi → Sportmonks → API) ve takım kökeni (büyük harf);
 *   - A fotoğrafı: oyuncunun o maçtaki takımının formalı EN YENİ arşiv fotoğrafı (yoksa tipografik yedek);
 *   - B vesikalıkları: aynı kural, ORİJİNAL dosyadan (büyütme tetiklenmez; yüz yoksa takım logosu).
 */

export async function loadPlayerStatsFacts(raw: ApiFootballFixtureResultRaw, now: Date): Promise<PlayerStatsFacts | null> {
  // Eşleme sağlayıcının özgün takım adlarıyla (Maç İstatistikleri ile aynı).
  const sportmonks = await getSportmonksPlayerLineups({ kickoffUtc: raw.fixture.date, homeTeam: { name: raw.teams.home.name }, awayTeam: { name: raw.teams.away.name } }).catch((error: unknown) => {
    console.error("[player-stats] Sportmonks eşlemesi düştü:", error);
    return null;
  });
  await warmTeamColors([{ id: raw.teams.home.id, name: raw.teams.home.name, logoUrl: raw.teams.home.logo }, { id: raw.teams.away.id, name: raw.teams.away.name, logoUrl: raw.teams.away.logo }]);
  const facts = assemblePlayerStatsFacts(raw, now, sportmonks);
  return facts ? { ...facts, match: await withTeamOrigins(facts.match) } : null;
}

const teamOf = (facts: PlayerStatsFacts, side: MatchSide): ResultTeam => (side === "HOME" ? facts.match.home : facts.match.away);

/** Kart adları — kişi adı kuralı (`lib/names/person-name.ts`), takımın kişi kökeni ipucuyla. */
export async function playerCardNames(facts: PlayerStatsFacts, lines: PlayerMatchLine[]): Promise<PlayerNames> {
  const names: PlayerNames = new Map();
  for (const side of ["HOME", "AWAY"] as const) {
    const team = teamOf(facts, side);
    const players = lines.filter((line) => line.side === side);
    if (players.length === 0) continue;
    const resolved = await resolvePlayerNames(
      { apiName: team.name, country: team.origin?.people === "tr" ? "Turkey" : null, peopleHint: team.origin?.people ?? null },
      players.map((line) => ({ apiId: line.playerId, apiName: line.name })),
    );
    players.forEach((line, index) => names.set(line.playerId, { name: resolved[index]?.name ?? line.name, origin: resolved[index]?.origin ?? null }));
  }
  return names;
}

/** Oyuncunun o maçtaki takımının formalı arşiv fotoğrafları, en yeni önce (eski forma girmez). */
async function kitPhotos(playerId: number, teamId: number) {
  return prisma.photo.findMany({
    where: { hiddenAt: null, kitTeamId: teamId, person: { apiId: playerId, role: "PLAYER" } },
    orderBy: { uploadedAt: "desc" },
    select: { id: true, originalUrl: true, upscaledUrl: true },
  });
}

export interface SpotlightPhoto {
  image: UploadedImage;
  photoId: string;
  fileUrl: string;
}

/**
 * A'nın fotoğrafı: seçilen (`photoId`, oyuncunun ve formasının doğrulanmasıyla) ya da en yeni formalı fotoğraf.
 * `avoidPhotoId` (carousel'de 01'in fotoğrafı) başka fotoğraf varsa atlanır. Hiç yoksa null → tipografik yedek.
 */
export async function spotlightPhoto(line: PlayerMatchLine, options: { photoId?: string | null; avoidPhotoId?: string | null } = {}): Promise<SpotlightPhoto | null> {
  const photos = await kitPhotos(line.playerId, line.teamId);
  const chosen = options.photoId ? photos.find((photo) => photo.id === options.photoId) : (photos.find((photo) => photo.id !== options.avoidPhotoId) ?? photos[0]);
  if (!chosen) return null;
  const card = await photoForCard(chosen, async (url) => {
    await prisma.photo.update({ where: { id: chosen.id }, data: { upscaledUrl: url } });
  });
  return card.ok ? { image: card.data.image, photoId: chosen.id, fileUrl: card.data.url } : null;
}

/** A'nın fotoğraf seçeneği var mı (stüdyo notu) — sorgu yalnızca kimlikleri okur. */
export async function spotlightPhotoIds(line: Pick<PlayerMatchLine, "playerId" | "teamId">): Promise<string[]> {
  return (await kitPhotos(line.playerId, line.teamId)).map((photo) => photo.id);
}

/** B vesikalıkları — orijinal dosyadan (yüz tespiti yerel); fotoğraf ya da yüz yoksa null (logo çizilir). */
export async function playerPortraits(lines: PlayerMatchLine[], hexOf: (line: PlayerMatchLine) => string): Promise<Map<number, string | null>> {
  const entries = await Promise.all(
    lines.map(async (line): Promise<[number, string | null]> => {
      const [photo] = await kitPhotos(line.playerId, line.teamId);
      const image = photo ? await readUrl(photo.originalUrl, "Arşiv fotoğrafı") : null;
      return [line.playerId, image?.ok ? await facePortrait(image.data, hexOf(line)) : null];
    }),
  );
  return new Map(entries);
}

/**
 * A posterinin TAM adı ("Samuel-Germain Mbangula" — ilk ad küçük, soyad büyük; Oyuncu Karşılaştırması ile
 * aynı kural `fullNameFromApi`). Öncelik: arşivdeki admin düzeltmesi (`nameOverride`) → API oyuncu kaydı
 * (`/players/profiles`, baş harfli ad ilk adla açılır) → arşivin resmi adı → sağlayıcı adı. Yalnızca okuma.
 */
export async function spotlightFullName(line: PlayerMatchLine, teamHint: NameOrigin | null): Promise<{ name: string; origin: NameOrigin | null }> {
  const person = await prisma.person.findFirst({ where: { apiId: line.playerId, role: "PLAYER" }, select: { officialName: true, nameOverride: true } }).catch(() => null);
  const override = person?.nameOverride?.trim();
  const profile = override ? null : await getPlayerProfile(line.playerId).catch(() => null);
  const fromApi = profile?.ok && profile.data ? fullNameFromApi(line.name, profile.data.firstname) : null;
  const name = override || (fromApi && fromApi !== line.name ? fromApi : null) || person?.officialName?.trim() || line.name;
  return { name, origin: nameOrigin(name) ?? teamHint };
}
