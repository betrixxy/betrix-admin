import Link from "next/link";
import type { TeamFolder, TreeLeague } from "@/lib/archive/queries";
import { cn } from "@/lib/utils";

/**
 * Arşiv ağacı (sol panel): Lig → Takım → mevki grupları → kişiler. Yalnızca seçili takım açılır
 * (gruplar sabit sırada, kişiler tr-TR alfabetik). Boş klasörler soluk, fotoğraf sayısı yanında.
 */

export function archiveHref(params: { team?: number; person?: string; group?: string; q?: string; inbox?: boolean }): string {
  const search = new URLSearchParams();
  if (params.team) search.set("team", String(params.team));
  if (params.person) search.set("person", params.person);
  if (params.group) search.set("group", params.group);
  if (params.q) search.set("q", params.q);
  if (params.inbox) search.set("inbox", "1");
  const query = search.toString();
  return `/dashboard/library${query ? `?${query}` : ""}`;
}

function Count({ value }: { value: number }) {
  return <span className="ml-auto pl-2 text-[10px] tabular-nums text-muted-foreground">{value}</span>;
}

function Row({ href, active, empty, children, count, indent }: { href: string; active: boolean; empty: boolean; children: React.ReactNode; count: number; indent: number }) {
  return (
    <Link
      href={href}
      className={cn("flex items-center rounded px-2 py-1 text-xs transition-colors", active ? "bg-white/[0.08] text-white" : empty ? "text-muted-foreground/50 hover:text-white" : "text-muted-foreground hover:text-white")}
      style={{ paddingLeft: 8 + indent * 12 }}
    >
      <span className="truncate">{children}</span>
      <Count value={count} />
    </Link>
  );
}

export function ArchiveTree({ leagues, folder, selectedPerson, inboxCount, inboxActive }: { leagues: TreeLeague[]; folder: TeamFolder | null; selectedPerson: string | null; inboxCount: number; inboxActive: boolean }) {
  return (
    <nav aria-label="Arşiv" className="flex flex-col gap-3">
      <Row href={archiveHref({ inbox: true })} active={inboxActive} empty={inboxCount === 0} count={inboxCount} indent={0}>
        Etiket bekleyenler
      </Row>
      {leagues.length === 0 ? <p className="px-2 text-xs text-muted-foreground">Arşiv boş — kadroları senkronlayın.</p> : null}
      {leagues.map((league) => (
        <div key={league.id} className="flex flex-col">
          <span className={cn("px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide", league.isNational ? "text-amber-300/80" : "text-white/70")}>{league.name}</span>
          {league.teams.map((team) => {
            const open = folder?.id === team.id;
            return (
              <div key={team.id} className="flex flex-col">
                <Row href={archiveHref({ team: team.id })} active={open && !selectedPerson} empty={team.photoCount === 0} count={team.photoCount} indent={1}>
                  {team.name}
                </Row>
                {open && folder
                  ? folder.groups.map((group) => {
                      const count = group.group === "TEAM" ? folder.teamPhotoCount : group.people.reduce((sum, person) => sum + person.photoCount, 0);
                      return (
                        <div key={group.group} className="flex flex-col">
                          <Row href={archiveHref({ team: team.id, group: group.group })} active={false} empty={count === 0} count={count} indent={2}>
                            {group.label}
                          </Row>
                          {group.people.map((person) => (
                            <Row key={person.id} href={archiveHref({ team: team.id, person: person.id })} active={selectedPerson === person.id} empty={person.photoCount === 0} count={person.photoCount} indent={3}>
                              {person.name}
                            </Row>
                          ))}
                        </div>
                      );
                    })
                  : null}
              </div>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
