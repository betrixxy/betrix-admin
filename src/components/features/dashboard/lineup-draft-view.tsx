import { DraftPublishPanel } from "@/components/features/dashboard/publishing/draft-publish-panel";
import { DraftPreview } from "@/components/features/dashboard/draft-preview";
import { DraftStatusBadge } from "@/components/features/dashboard/draft-status-badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { StudioPostOption } from "@/types/ai-content";
import type { LineupDraftView as LineupDraft } from "@/types/draft";
import { LINEUP_TEMPLATE_LABELS } from "@/types/lineup";
import { SOCIAL_FORMATS, socialFormatCaption } from "@/types/studio-formats";

/**
 * Muhtemel 11 taslağının incelemesi: iki takımın kadro kartı yan yana ve Yayın Merkezi (platform, metin, dizilim, onay/ret).
 * Kartlar programatiktir — düzenleme stüdyoda yapılır (yeniden kaydetmek yeni taslak üretir).
 */
export function LineupDraftView({ draft, postOptions }: { draft: LineupDraft; postOptions: StudioPostOption[] }) {
  const { width, height } = SOCIAL_FORMATS[draft.format];
  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <CardTitle>{draft.headline} Kartları</CardTitle>
            <DraftStatusBadge status={draft.status} />
          </div>
          <CardDescription>
            Her takım için ayrı kart · {socialFormatCaption(draft.format)} — carousel olarak birlikte paylaşılır.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-2">
          {(["home", "away"] as const).map((side) => (
            <div key={side} className="flex flex-col gap-2">
              <p className="text-sm font-medium">
                {draft[side].teamName}{" "}
                <span className="text-muted-foreground">
                  · {draft[side].formation} · {LINEUP_TEMPLATE_LABELS[draft[side].templateStyle]} · {side === "home" ? "Ev sahibi" : "Deplasman"}
                </span>
              </p>
              <DraftPreview
                url={draft[side].imageUrl}
                width={width}
                height={height}
                alt={`${draft[side].teamName} muhtemel 11 kartı`}
                downloadName={`checkmatch-11-${side}-${draft.id}`}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <DraftPublishPanel draft={draft} format={draft.format} postOptions={postOptions} downloadName={`checkmatch-11-${draft.id}`} />
    </div>
  );
}
