import Link from "next/link";
import { RenderThumbnail } from "./render-thumbnail";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { draftQueueLabel } from "@/lib/dashboard/draft-queue-label";
import { clock, shortDate } from "@/lib/format/dates";
import type { DraftSummary } from "@/types/draft";

interface DraftQueueProps {
  drafts: DraftSummary[];
  fixtureLabels: Record<string, string>;
}

/** Onay bekleyen taslaklar — admin'in "yapılacaklar" listesi: tür adı + okunur başlık (ham kayıt anahtarı yok). */
export function DraftQueue({ drafts, fixtureLabels }: DraftQueueProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Onay Bekleyen Taslaklar</CardTitle>
        <CardDescription>
          {drafts.length === 0
            ? "Bekleyen taslak yok — bir maçın yanında içerik türünü seçip \"Stüdyoya Git\" ile başlayın."
            : `${drafts.length} taslak incelemenizi bekliyor.`}
        </CardDescription>
      </CardHeader>
      {drafts.length > 0 ? (
        <CardContent>
          <ul className="flex gap-3 overflow-x-auto pb-1">
            {drafts.map((draft) => {
              const label = draftQueueLabel(draft, fixtureLabels);
              return (
                <li key={draft.id} className="w-32 shrink-0">
                  <Link href={`/dashboard/drafts/${draft.id}`} className="group flex flex-col gap-1.5" title={`${label.type} · ${label.title}`}>
                    <div className="flex aspect-[4/5] items-center justify-center overflow-hidden rounded-md bg-muted/30 ring-1 ring-border transition group-hover:ring-emerald-500/60">
                      <RenderThumbnail src={draft.resultImageUrl} alt={`${label.type} taslağı`} />
                    </div>
                    <span className="truncate text-[10px] font-medium uppercase tracking-wide text-emerald-300">{label.type}</span>
                    <span className="line-clamp-2 text-[11px] leading-snug text-white">{label.title}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {shortDate(draft.createdAt)} {clock(draft.createdAt)}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </CardContent>
      ) : null}
    </Card>
  );
}
