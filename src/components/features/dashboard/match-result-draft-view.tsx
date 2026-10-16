import { DraftPublishPanel } from "@/components/features/dashboard/publishing/draft-publish-panel";
import { DraftPreview } from "@/components/features/dashboard/draft-preview";
import { DraftStatusBadge } from "@/components/features/dashboard/draft-status-badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { StudioPostOption } from "@/types/ai-content";
import type { MatchResultDraftView as MatchResultDraft } from "@/types/draft";
import { SOCIAL_FORMATS, socialFormatCaption } from "@/types/studio-formats";

/**
 * Maç Sonucu taslağının incelemesi: kart, gönderi metni ve onay/ret. Kart değişikliği stüdyoda
 * yapılır (yeniden üretmek yeni bir taslak açar).
 */
export function MatchResultDraftView({ draft, postOptions }: { draft: MatchResultDraft; postOptions: StudioPostOption[] }) {
  const frame = SOCIAL_FORMATS[draft.format];
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <CardTitle>{draft.title}</CardTitle>
            <DraftStatusBadge status={draft.status} />
          </div>
          <CardDescription>
            {draft.subtitle} · Maçın oyuncusu: {draft.mvpName} · {socialFormatCaption(draft.format)}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DraftPreview url={draft.imageUrl} width={frame.width} height={frame.height} alt={`${draft.title} maç sonucu kartı`} downloadName={`checkmatch-mac-sonucu-${draft.id}`} />
        </CardContent>
      </Card>

      <DraftPublishPanel draft={draft} format={draft.format} postOptions={postOptions} downloadName={`checkmatch-mac-sonucu-${draft.id}`} />
    </div>
  );
}
