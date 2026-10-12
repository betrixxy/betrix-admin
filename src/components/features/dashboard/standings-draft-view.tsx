import { DraftPublishPanel } from "@/components/features/dashboard/publishing/draft-publish-panel";
import { DraftPreview } from "@/components/features/dashboard/draft-preview";
import { DraftStatusBadge } from "@/components/features/dashboard/draft-status-badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { StudioPostOption } from "@/types/ai-content";
import type { StandingsDraftView as StandingsDraft } from "@/types/draft";
import { SOCIAL_FORMATS, socialFormatCaption } from "@/types/studio-formats";

/**
 * Puan Durumu taslağının incelemesi: kart, gönderi metni ve onay/ret. Kart programatiktir — değişiklik
 * stüdyoda yapılır (yeniden kaydetmek güncel tabloyla yeni taslak üretir).
 */
export function StandingsDraftView({ draft, postOptions }: { draft: StandingsDraft; postOptions: StudioPostOption[] }) {
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <CardTitle>{draft.title}</CardTitle>
            <DraftStatusBadge status={draft.status} />
          </div>
          <CardDescription>
            {draft.leagueName} · {draft.kindLabel} · {draft.teamCount} takım · {socialFormatCaption(draft.format)} — tablo kaydedildiği andaki haliyle.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DraftPreview url={draft.imageUrl} width={SOCIAL_FORMATS[draft.format].width} height={SOCIAL_FORMATS[draft.format].height} alt={`${draft.leagueName} ${draft.title} kartı`} downloadName={`checkmatch-puan-durumu-${draft.id}`} />
        </CardContent>
      </Card>

      <DraftPublishPanel draft={draft} format={draft.format} postOptions={postOptions} downloadName={`checkmatch-puan-durumu-${draft.id}`} />
    </div>
  );
}
