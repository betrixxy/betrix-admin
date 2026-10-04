import Link from "next/link";
import { RenderThumbnail } from "./render-thumbnail";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { DraftSummary } from "@/types/draft";

interface DraftQueueProps {
  drafts: DraftSummary[];
  fixtureLabels: Record<string, string>;
}

/** Onay bekleyen taslaklar — admin'in "yapılacaklar" listesi. */
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
            {drafts.map((draft) => (
              <li key={draft.id} className="w-32 shrink-0">
                <Link href={`/dashboard/drafts/${draft.id}`} className="group flex flex-col gap-1.5">
                  <div className="flex aspect-[4/5] items-center justify-center overflow-hidden rounded-md bg-muted/30 ring-1 ring-border transition group-hover:ring-emerald-500/60">
                    <RenderThumbnail src={draft.resultImageUrl} alt="Taslak görsel" />
                  </div>
                  <span className="truncate text-[11px] text-white">{fixtureLabels[draft.fixtureId] ?? draft.fixtureId}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {format(new Date(draft.createdAt), "d MMM, HH:mm", { locale: tr })}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </CardContent>
      ) : null}
    </Card>
  );
}
