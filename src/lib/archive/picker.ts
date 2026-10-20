import { prisma } from "@/lib/prisma";
import type { ArchivePickerTeam, PickerPhoto } from "@/types/archive";
import { displayPersonName } from "./names";
import { orderPickerPhotos, ownKitOnly, photoBucket } from "./picker-order";
import { groupPeople } from "./structure";
import { syncTeam } from "./sync";

/**
 * Stüdyo arşiv seçicisinin verisi (Maç Sonucu ve fotoğraf isteyen tüm stüdyolar). Maçtaki her
 * takım için: "Takım fotoğrafı" en üstte, sonra Teknik Direktör, sonra mevki gruplarına göre
 * oyuncular; her kişinin/takımın fotoğrafları `orderPickerPhotos` sırasıyla. Takım arşivde yoksa ya
 * da kadrosu hiç senkronlanmadıysa gerektikçe senkronlanır (yalnızca API okuması).
 */

const MAX_PHOTOS_PER_SUBJECT = 30;
const VISIBLE = { hiddenAt: null } as const;

export const teamSubject = (teamId: number) => `team:${teamId}`;
export const personSubject = (personId: string) => `person:${personId}`;

async function ensureSynced(teamId: number): Promise<string | null> {
  const team = await prisma.team.findUnique({ where: { id: teamId }, select: { squadSyncedAt: true } });
  if (team?.squadSyncedAt) return null;
  const synced = await syncTeam(teamId);
  return synced.ok ? null : synced.error.message;
}

/** `kitOnly`: yalnızca forması o takımın olan fotoğraflar (vitrin posterinin ev/deplasman yarısı). */
export async function loadPickerTeams(teamIds: number[], fixtureId: string | null, options: { kitOnly?: boolean } = {}): Promise<{ teams: ArchivePickerTeam[]; warnings: string[] }> {
  const warnings: string[] = [];
  const teams: ArchivePickerTeam[] = [];
  for (const teamId of [...new Set(teamIds)]) {
    const syncError = await ensureSynced(teamId);
    if (syncError) warnings.push(`Takım ${teamId} kadrosu alınamadı: ${syncError}`);
    const team = await prisma.team.findUnique({ where: { id: teamId } });
    if (!team) continue;
    const people = await prisma.person.findMany({
      where: team.national ? { nationalTeamId: teamId } : { currentTeamId: teamId },
      select: { id: true, apiId: true, role: true, position: true, officialName: true, nameOverride: true },
    });
    const personIds = people.map((person) => person.id);
    const all = await prisma.photo.findMany({
      where: { ...VISIBLE, OR: [{ teamId, personId: null }, { personId: { in: personIds } }] },
      include: { kitTeam: { select: { officialName: true } } },
      orderBy: { uploadedAt: "desc" },
    });
    const rows = options.kitOnly ? ownKitOnly(all, teamId) : all;
    const toPicker = (row: (typeof rows)[number]): PickerPhoto => ({
      id: row.id,
      url: row.originalUrl,
      caption: row.caption,
      kind: row.kind,
      kitTeamName: row.kitTeam.officialName,
      bucket: photoBucket(row, teamId, fixtureId),
      width: row.width,
      height: row.height,
    });
    const photos: Record<string, PickerPhoto[]> = {
      [teamSubject(teamId)]: orderPickerPhotos(rows.filter((row) => row.personId === null && row.teamId === teamId), teamId, fixtureId).slice(0, MAX_PHOTOS_PER_SUBJECT).map(toPicker),
    };
    for (const person of people) {
      photos[personSubject(person.id)] = orderPickerPhotos(rows.filter((row) => row.personId === person.id), teamId, fixtureId).slice(0, MAX_PHOTOS_PER_SUBJECT).map(toPicker);
    }
    const grouped = groupPeople(people.map((person) => ({ ...person, name: displayPersonName(person) })));
    teams.push({
      teamId,
      name: team.officialName,
      groups: grouped.map((group) => ({
        group: group.group,
        label: group.label,
        subjects:
          group.group === "TEAM"
            ? [{ key: teamSubject(teamId), label: `Takım fotoğrafı — ${team.officialName}`, personApiId: null, isPlayer: false }]
            : group.people.map((person) => ({ key: personSubject(person.id), label: person.name, personApiId: person.apiId, isPlayer: person.role === "PLAYER" })),
      })),
      photos,
    });
  }
  return { teams, warnings };
}
