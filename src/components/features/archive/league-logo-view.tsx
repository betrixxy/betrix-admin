import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { LeagueLogoUploadForm } from "@/components/features/archive/league-logo-upload-form";
import { MediaDeleteButton } from "@/components/features/dashboard/media-delete-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { type LeagueLogoRow, LEAGUE_LOGO_SOURCE_LABELS } from "@/lib/dashboard/league-logo";

/** Logo önizlemesi: renkli/siyah logo için beyaz plaka — kartta da böyle çizilir. */
function LogoPreview({ row, size }: { row: LeagueLogoRow; size: string }) {
  if (!row.activeUrl) return <span className={`flex ${size} items-center justify-center rounded-lg bg-white/[0.04] text-[10px] text-muted-foreground ring-1 ring-border`}>Logo yok</span>;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={row.activeUrl} alt={`${row.name} logosu`} className={`${size} rounded-lg bg-white object-contain p-1.5`} />
  );
}

/** Logolar sekmesinin üstü: bütün ligler, kullanılan logo ve kaynağı; satır lig sayfasına gider. */
export function LeagueLogoList({ rows }: { rows: LeagueLogoRow[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Lig Logoları</CardTitle>
        <CardDescription>Haftanın Maçları, Puan Durumu ve Maç Günü kartlarında: yüklenen logo → API-Football logosu → yalnızca lig adı.</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((row) => (
            <li key={row.id}>
              <Link href={`/dashboard/library?league=${row.id}`} className="flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-white/[0.04]">
                <LogoPreview row={row} size="size-11" />
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-sm text-white">{row.name}</span>
                  <span className="text-xs text-muted-foreground">{LEAGUE_LOGO_SOURCE_LABELS[row.source]}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

/** Lig sayfası (`/dashboard/library?league=<id>`): kullanılan logo + "logo yükle". */
export function LeagueLogoPage({ row }: { row: LeagueLogoRow }) {
  return (
    <div className="flex flex-col gap-4">
      <Link href="/dashboard/library?view=logos" className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-white">
        <ArrowLeft className="size-3.5" />
        Lig logoları
      </Link>
      <Card>
        <CardHeader>
          <CardTitle>{row.name}</CardTitle>
          <CardDescription>Kartlarda kullanılan logo: {LEAGUE_LOGO_SOURCE_LABELS[row.source]}. Yeni yükleme öncekinin önüne geçer.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 sm:grid-cols-[auto_1fr]">
          <div className="flex flex-col items-start gap-2">
            <LogoPreview row={row} size="size-32" />
            {row.adminAssetId ? <MediaDeleteButton id={row.adminAssetId} /> : null}
          </div>
          <LeagueLogoUploadForm leagueId={row.id} leagueName={row.name} />
        </CardContent>
      </Card>
    </div>
  );
}
