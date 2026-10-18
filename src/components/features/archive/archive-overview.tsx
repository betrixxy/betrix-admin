import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { TreeLeague } from "@/lib/archive/queries";
import { archiveHref } from "./archive-tree";

/** Arşiv açılış görünümü: lig başına takım/fotoğraf sayısı ve etiket bekleyenler. */
export function ArchiveContentOverview({ tree, inboxCount }: { tree: TreeLeague[]; inboxCount: number }) {
  const photos = tree.reduce((sum, league) => sum + league.teams.reduce((teamSum, team) => teamSum + team.photoCount, 0), 0);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Fotoğraf Arşivi</CardTitle>
        <CardDescription>
          {photos} fotoğraf · {tree.reduce((sum, league) => sum + league.teams.length, 0)} takım. Soldan bir takım ya da kişi seçin; fotoğraf o klasöre yüklenir.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {inboxCount > 0 ? (
          <Link href={archiveHref({ inbox: true })} className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300 hover:bg-amber-500/15">
            {inboxCount} eski fotoğraf etiket bekliyor — kişisini/takımını seçip arşive alın.
          </Link>
        ) : null}
        {tree.length === 0 ? (
          <p className="text-sm text-muted-foreground">Arşivde henüz takım yok. Soldaki &quot;Türk liglerini senkronla&quot; ile Trendyol Süper Lig ve 1. Lig kadroları gelir; diğer takımlar fotoğraf yüklendikçe eklenir.</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {tree.map((league) => (
              <li key={league.id} className="rounded-lg border border-border p-3">
                <span className="text-sm font-medium text-white">{league.name}</span>
                <span className="block text-xs text-muted-foreground">
                  {league.teams.length} takım · {league.teams.reduce((sum, team) => sum + team.photoCount, 0)} fotoğraf
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
