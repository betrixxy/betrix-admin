import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getFolderPhotos, getPerson, type ArchivePhotoView, type SearchResults, type TeamFolder } from "@/lib/archive/queries";
import { ARCHIVE_GROUP_LABELS, type ArchiveGroup } from "@/lib/archive/structure";
import { ArchivePhotoCard } from "./archive-photo-card";
import { ArchivePersonTools } from "./archive-person-tools";
import { archiveHref } from "./archive-tree";
import { ArchiveUploadForm } from "./archive-upload-form";

/** Arşivin sağ paneli — takım klasörü, kişi klasörü, grup listesi, arama sonuçları. */

type Teams = { id: number; name: string }[];

function PhotoGrid({ photos, teams, empty }: { photos: ArchivePhotoView[]; teams: Teams; empty: string }) {
  if (photos.length === 0) return <p className="py-8 text-center text-sm text-muted-foreground">{empty}</p>;
  return (
    <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
      {photos.map((photo) => (
        <ArchivePhotoCard key={photo.id} photo={photo} teams={teams} />
      ))}
    </ul>
  );
}

const POSITION_LABELS = { GK: "Kaleci", DEF: "Defans", MID: "Orta saha", FWD: "Forvet" } as const;

export async function PersonFolderView({ folder, personId, teams }: { folder: TeamFolder; personId: string; teams: Teams }) {
  const [person, photos] = await Promise.all([getPerson(personId), getFolderPhotos(folder.id, personId)]);
  if (!person) return <p className="text-sm text-muted-foreground">Kişi bulunamadı.</p>;
  const role = person.role === "COACH" ? "Teknik direktör" : person.position ? POSITION_LABELS[person.position] : "Mevki bilinmiyor";
  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>{person.name}</CardTitle>
          <CardDescription>
            {folder.leagueName ? `${folder.leagueName} / ` : ""}
            <Link href={archiveHref({ team: folder.id })} className="underline-offset-2 hover:underline">{folder.name}</Link> / {role}
            {person.currentTeamName && person.currentTeamId !== folder.id ? ` · güncel kulübü: ${person.currentTeamName}` : ""}
            {person.pendingTeamName ? ` · kadro değişikliği önerisi: ${person.pendingTeamName}` : ""}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PhotoGrid photos={photos} teams={teams} empty="Bu klasörde henüz fotoğraf yok — aşağıdan yükleyin." />
        </CardContent>
      </Card>
      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Fotoğraf ekle</CardTitle></CardHeader>
          <CardContent>
            <ArchiveUploadForm teamId={folder.id} personId={person.id} folderLabel={`${folder.name} / ${person.name}`} teams={teams} defaultKind="CELEBRATION" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Kişi</CardTitle></CardHeader>
          <CardContent>
            <ArchivePersonTools person={person} teams={teams} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export async function TeamFolderView({ folder, group, teams }: { folder: TeamFolder; group: ArchiveGroup | null; teams: Teams }) {
  const showPhotos = group === null || group === "TEAM";
  const photos = showPhotos ? await getFolderPhotos(folder.id, null) : [];
  const groups = group && group !== "TEAM" ? folder.groups.filter((entry) => entry.group === group) : folder.groups.filter((entry) => entry.group !== "TEAM");
  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>{folder.name}{group ? ` / ${ARCHIVE_GROUP_LABELS[group]}` : ""}</CardTitle>
          <CardDescription>{folder.leagueName ?? (folder.national ? "Milli takım" : "Lig bilinmiyor")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          {showPhotos ? (
            <section className="flex flex-col gap-3">
              <h3 className="text-sm font-medium text-white">{ARCHIVE_GROUP_LABELS.TEAM}</h3>
              <PhotoGrid photos={photos} teams={teams} empty="Takım fotoğrafı yok." />
            </section>
          ) : null}
          {groups.map((entry) => (
            <section key={entry.group} className="flex flex-col gap-2">
              <h3 className="text-sm font-medium text-white">{entry.label}</h3>
              {entry.people.length === 0 ? (
                <p className="text-xs text-muted-foreground">Kadroda kişi yok — kadroyu senkronlayın.</p>
              ) : (
                <ul className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
                  {entry.people.map((person) => (
                    <li key={person.id}>
                      <Link href={archiveHref({ team: folder.id, person: person.id })} className={person.photoCount === 0 ? "text-xs text-muted-foreground/60 hover:text-white" : "text-xs text-white hover:underline"}>
                        {person.name} <span className="text-[10px] text-muted-foreground">{person.photoCount}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </CardContent>
      </Card>
      {showPhotos ? (
        <Card className="xl:max-w-xl">
          <CardHeader><CardTitle className="text-base">Takım fotoğrafı ekle</CardTitle></CardHeader>
          <CardContent>
            <ArchiveUploadForm teamId={folder.id} personId={null} folderLabel={`${folder.name} / ${ARCHIVE_GROUP_LABELS.TEAM}`} teams={teams} defaultKind="TEAM" />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

export function SearchResultsView({ query, results, teams }: { query: string; results: SearchResults; teams: Teams }) {
  const total = results.people.length + results.teams.length + results.photos.length;
  return (
    <Card>
      <CardHeader>
        <CardTitle>&quot;{query}&quot; için sonuçlar</CardTitle>
        <CardDescription>{total === 0 ? "Sonuç yok (en az 2 karakter)." : `${results.people.length} kişi · ${results.teams.length} takım · ${results.photos.length} fotoğraf`}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {results.people.length ? (
          <ul className="flex flex-wrap gap-2">
            {results.people.map((person) => (
              <li key={person.id}>
                <Link href={person.teamId ? archiveHref({ team: person.teamId, person: person.id }) : archiveHref({})} className="rounded-md border border-border px-2 py-1 text-xs text-white hover:bg-white/[0.06]">
                  {person.name} <span className="text-muted-foreground">{person.teamName ?? "takımsız"}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
        {results.teams.length ? (
          <ul className="flex flex-wrap gap-2">
            {results.teams.map((team) => (
              <li key={team.id}>
                <Link href={archiveHref({ team: team.id })} className="rounded-md border border-border px-2 py-1 text-xs text-white hover:bg-white/[0.06]">{team.name}</Link>
              </li>
            ))}
          </ul>
        ) : null}
        {results.photos.length ? <PhotoGrid photos={results.photos} teams={teams} empty="" /> : null}
      </CardContent>
    </Card>
  );
}
