import { prisma } from "@/lib/prisma";
import { compareTr, displayPersonName } from "./names";
import { groupPeople, type ArchiveGroup, type ArchivePosition, type ArchiveRole } from "./structure";

/**
 * Arşiv sayfasının sorguları — ağaç, takım/kişi klasörü, arama, transfer önerileri, etiket
 * bekleyenler. Gizlenen (`hiddenAt`) fotoğraflar hiçbir listede ve sayımda yoktur.
 */

const VISIBLE = { hiddenAt: null } as const;

export interface TreeTeam {
  id: number;
  name: string;
  logoUrl: string | null;
  photoCount: number;
}

export interface TreeLeague {
  id: number;
  name: string;
  isNational: boolean;
  teams: TreeTeam[];
}

/** Lig → takım (ağaç sırası: ligin `sortOrder`'ı, sonra tr-TR ad; takımlar tr-TR ad). */
export async function getArchiveTree(): Promise<TreeLeague[]> {
  const [leagues, teams, counts] = await Promise.all([
    prisma.league.findMany({ select: { id: true, officialName: true, isNational: true, sortOrder: true } }),
    prisma.team.findMany({ select: { id: true, officialName: true, logoUrl: true, currentLeagueId: true } }),
    prisma.photo.groupBy({ by: ["teamId"], where: VISIBLE, _count: { _all: true } }),
  ]);
  const countBy = new Map(counts.map((row) => [row.teamId, row._count._all]));
  return leagues
    .sort((a, b) => a.sortOrder - b.sortOrder || compareTr(a.officialName, b.officialName))
    .map((league) => ({
      id: league.id,
      name: league.officialName,
      isNational: league.isNational,
      teams: teams
        .filter((team) => team.currentLeagueId === league.id)
        .map((team) => ({ id: team.id, name: team.officialName, logoUrl: team.logoUrl, photoCount: countBy.get(team.id) ?? 0 }))
        .sort((a, b) => compareTr(a.name, b.name)),
    }))
    .filter((league) => league.teams.length > 0);
}

export interface FolderPerson {
  id: string;
  name: string;
  role: ArchiveRole;
  position: ArchivePosition | null;
  photoCount: number;
}

export interface TeamFolder {
  id: number;
  name: string;
  national: boolean;
  logoUrl: string | null;
  leagueName: string | null;
  teamPhotoCount: number;
  groups: { group: ArchiveGroup; label: string; people: FolderPerson[] }[];
}

/**
 * Takım klasörü: kulüpte güncel kadrosu (`currentTeamId`), milli takımda milli kadrosu
 * (`nationalTeamId`) + o milli formayla fotoğrafı olanlar. Kişi sayısı bu klasördeki fotoğraflar.
 */
export async function getTeamFolder(teamId: number): Promise<TeamFolder | null> {
  const team = await prisma.team.findUnique({ where: { id: teamId }, include: { currentLeague: { select: { officialName: true } } } });
  if (!team) return null;
  const membership = team.national ? { OR: [{ nationalTeamId: teamId }, { photos: { some: { teamId, ...VISIBLE } } }] } : { currentTeamId: teamId };
  const [people, counts, teamPhotoCount] = await Promise.all([
    prisma.person.findMany({ where: membership, select: { id: true, officialName: true, nameOverride: true, role: true, position: true } }),
    prisma.photo.groupBy({ by: ["personId"], where: { teamId, personId: { not: null }, ...VISIBLE }, _count: { _all: true } }),
    prisma.photo.count({ where: { teamId, personId: null, ...VISIBLE } }),
  ]);
  const countBy = new Map(counts.map((row) => [row.personId, row._count._all]));
  const folderPeople = people.map((person) => ({ id: person.id, name: displayPersonName(person), role: person.role, position: person.position, photoCount: countBy.get(person.id) ?? 0 }));
  return {
    id: team.id,
    name: team.officialName,
    national: team.national,
    logoUrl: team.logoUrl,
    leagueName: team.currentLeague?.officialName ?? null,
    teamPhotoCount,
    groups: groupPeople(folderPeople),
  };
}

export interface ArchivePhotoView {
  id: string;
  personId: string | null;
  personName: string | null;
  teamId: number;
  teamName: string;
  kitTeamId: number;
  kitTeamName: string;
  fixtureId: string | null;
  kind: "CELEBRATION" | "PORTRAIT" | "ACTION" | "TEAM";
  caption: string;
  credit: string;
  takenAt: string | null;
  uploadedAt: string;
  originalUrl: string;
  upscaledUrl: string | null;
  width: number;
  height: number;
}

const photoInclude = {
  person: { select: { officialName: true, nameOverride: true } },
  team: { select: { officialName: true } },
  kitTeam: { select: { officialName: true } },
} as const;

type PhotoRow = Awaited<ReturnType<typeof prisma.photo.findMany<{ include: typeof photoInclude }>>>[number];

function toView(row: PhotoRow): ArchivePhotoView {
  return {
    id: row.id,
    personId: row.personId,
    personName: row.person ? displayPersonName(row.person) : null,
    teamId: row.teamId,
    teamName: row.team.officialName,
    kitTeamId: row.kitTeamId,
    kitTeamName: row.kitTeam.officialName,
    fixtureId: row.fixtureId,
    kind: row.kind,
    caption: row.caption,
    credit: row.credit,
    takenAt: row.takenAt?.toISOString() ?? null,
    uploadedAt: row.uploadedAt.toISOString(),
    originalUrl: row.originalUrl,
    upscaledUrl: row.upscaledUrl,
    width: row.width,
    height: row.height,
  };
}

/** Klasörün fotoğrafları: kişi verilirse kişinin bu takım klasöründekiler, yoksa takım fotoğrafları. */
export async function getFolderPhotos(teamId: number, personId: string | null): Promise<ArchivePhotoView[]> {
  const rows = await prisma.photo.findMany({ where: { teamId, personId, ...VISIBLE }, include: photoInclude, orderBy: { uploadedAt: "desc" } });
  return rows.map(toView);
}

export interface PersonHeader {
  id: string;
  name: string;
  officialName: string;
  nameOverride: string | null;
  role: ArchiveRole;
  position: ArchivePosition | null;
  currentTeamId: number | null;
  currentTeamName: string | null;
  pendingTeamName: string | null;
}

export async function getPerson(personId: string): Promise<PersonHeader | null> {
  const person = await prisma.person.findUnique({
    where: { id: personId },
    include: { currentTeam: { select: { officialName: true } }, pendingTeam: { select: { officialName: true } } },
  });
  if (!person) return null;
  return {
    id: person.id,
    name: displayPersonName(person),
    officialName: person.officialName,
    nameOverride: person.nameOverride,
    role: person.role,
    position: person.position,
    currentTeamId: person.currentTeamId,
    currentTeamName: person.currentTeam?.officialName ?? null,
    pendingTeamName: person.pendingTeam?.officialName ?? null,
  };
}

/** Forma takımı / transfer seçimi için arşivdeki takımlar (tr-TR ad sırası). */
export async function getTeamOptions(): Promise<{ id: number; name: string }[]> {
  const teams = await prisma.team.findMany({ select: { id: true, officialName: true } });
  return teams.map((team) => ({ id: team.id, name: team.officialName })).sort((a, b) => compareTr(a.name, b.name));
}

export interface SearchResults {
  people: { id: string; name: string; teamId: number | null; teamName: string | null }[];
  teams: { id: number; name: string }[];
  photos: ArchivePhotoView[];
}

/** Arama: kişi (resmi ad + düzeltme), takım (resmi ad), fotoğraf açıklaması — büyük/küçük harf duyarsız. */
export async function searchArchive(query: string): Promise<SearchResults> {
  const q = query.trim();
  if (q.length < 2) return { people: [], teams: [], photos: [] };
  const contains = { contains: q, mode: "insensitive" as const };
  const [people, teams, photos] = await Promise.all([
    prisma.person.findMany({
      where: { OR: [{ officialName: contains }, { nameOverride: contains }, { apiName: contains }] },
      include: { currentTeam: { select: { officialName: true } } },
      take: 30,
    }),
    prisma.team.findMany({ where: { OR: [{ officialName: contains }, { apiName: contains }] }, take: 20 }),
    prisma.photo.findMany({ where: { caption: contains, ...VISIBLE }, include: photoInclude, take: 30, orderBy: { uploadedAt: "desc" } }),
  ]);
  return {
    people: people
      .map((person) => ({ id: person.id, name: displayPersonName(person), teamId: person.currentTeamId, teamName: person.currentTeam?.officialName ?? null }))
      .sort((a, b) => compareTr(a.name, b.name)),
    teams: teams.map((team) => ({ id: team.id, name: team.officialName })).sort((a, b) => compareTr(a.name, b.name)),
    photos: photos.map(toView),
  };
}

export interface PendingTransfer {
  personId: string;
  name: string;
  fromTeam: string | null;
  toTeamId: number;
  toTeam: string;
}

/** "Taşınsın mı?" önerileri — senkron başka takım kadrosunda gördü, otomatik taşınmadı. */
export async function getPendingTransfers(): Promise<PendingTransfer[]> {
  const people = await prisma.person.findMany({
    where: { pendingTeamId: { not: null } },
    include: { currentTeam: { select: { officialName: true } }, pendingTeam: { select: { id: true, officialName: true } } },
  });
  return people.flatMap((person) =>
    person.pendingTeam ? [{ personId: person.id, name: displayPersonName(person), fromTeam: person.currentTeam?.officialName ?? null, toTeamId: person.pendingTeam.id, toTeam: person.pendingTeam.officialName }] : [],
  );
}

export interface InboxAsset {
  id: string;
  label: string;
  fileUrl: string;
  width: number;
  height: number;
  createdAt: string;
}

/** Etiket bekleyenler: arşive taşınmamış eski oyuncu/maç fotoğrafları (`MediaAsset`). */
export async function getInbox(): Promise<InboxAsset[]> {
  const migrated = await prisma.photo.findMany({ where: { legacyAssetId: { not: null } }, select: { legacyAssetId: true } });
  const ids = migrated.flatMap((row) => (row.legacyAssetId ? [row.legacyAssetId] : []));
  const rows = await prisma.mediaAsset.findMany({
    where: { category: { in: ["PLAYER", "MATCH_PHOTO"] }, id: { notIn: ids } },
    orderBy: { createdAt: "desc" },
    select: { id: true, label: true, fileUrl: true, width: true, height: true, createdAt: true },
  });
  return rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() }));
}

/** Seçicilerde kişi listesi (etiketleme): kişinin kulübü ve milli takımı — ikisinin klasörüne de girebilir. */
export async function getPeopleOptions(): Promise<{ id: string; name: string; teamIds: number[]; teamName: string | null }[]> {
  const people = await prisma.person.findMany({ include: { currentTeam: { select: { officialName: true } } } });
  return people
    .map((person) => ({
      id: person.id,
      name: displayPersonName(person),
      teamIds: [person.currentTeamId, person.nationalTeamId].filter((id): id is number => id !== null),
      teamName: person.currentTeam?.officialName ?? null,
    }))
    .sort((a, b) => compareTr(a.teamName ?? "", b.teamName ?? "") || compareTr(a.name, b.name));
}
