import { DraftPublishPanel } from "@/components/features/dashboard/publishing/draft-publish-panel";
import { DraftPreview } from "@/components/features/dashboard/draft-preview";
import { DraftStatusBadge } from "@/components/features/dashboard/draft-status-badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { StudioPostOption } from "@/types/ai-content";
import type { WeeklyFixturesDraftView as WeeklyDraft } from "@/types/draft";
import { SOCIAL_FORMATS, socialFormatCaption } from "@/types/studio-formats";

/**
 * Haftanın Maçları taslağının incelemesi: kart, gönderi metni ve onay/ret. Kart programatiktir —
 * değişiklik stüdyoda yapılır (yeniden kaydetmek güncel skorlarla yeni taslak üretir).
 */
export function WeeklyFixturesDraftView({ draft, postOptions }: { draft: WeeklyDraft; postOptions: StudioPostOption[] }) {
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <CardTitle>{draft.title}</CardTitle>
            <DraftStatusBadge status={draft.status} />
          </div>
          <CardDescription>
            {draft.leagueName} · {draft.matchCount} maç · {socialFormatCaption(draft.format)} — skorlar/saatler kaydedildiği andaki haliyle.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DraftPreview url={draft.imageUrl} width={SOCIAL_FORMATS[draft.format].width} height={SOCIAL_FORMATS[draft.format].height} alt={`${draft.leagueName} ${draft.title} kartı`} downloadName={`checkmatch-hafta-${draft.id}`} />
        </CardContent>
      </Card>

      <DraftPublishPanel draft={draft} format={draft.format} postOptions={postOptions} downloadName={`checkmatch-hafta-${draft.id}`} />
    </div>
  );
}
