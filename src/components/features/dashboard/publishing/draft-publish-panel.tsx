import { isAnthropicConfigured } from "@/lib/services/anthropic";
import { getPublishTargets } from "@/lib/services/social/publish";
import type { StudioPostOption } from "@/types/ai-content";
import type { AiContentStatus } from "@/types/ai-content";
import type { PublishableDraft } from "@/types/draft";
import type { SocialFormatId } from "@/types/studio-formats";
import { PublishNow } from "./publish-now";
import { PublishedSummary } from "./published-summary";
import { PublishingHub } from "./publishing-hub";

interface DraftPublishPanelProps {
  draft: PublishableDraft & { id: string; status: AiContentStatus; caption: string; postId: string | null; reviewedAt: string | null };
  format: SocialFormatId | null;
  postOptions: StudioPostOption[];
  downloadName: string;
}

/**
 * Taslak türünden bağımsız yayın paneli: karar bekleyen taslakta Yayın Merkezi, karara bağlanmış (onaylı,
 * reddedilmiş, yayınlanmış) taslakta özet. "Hemen Paylaş" durumu (bağlantı/izin) sunucuda hesaplanır.
 */
export async function DraftPublishPanel({ draft, format, postOptions, downloadName }: DraftPublishPanelProps) {
  if (draft.status !== "DRAFT") {
    // Onaylanmış ama henüz paylaşılmamış taslak, onaydaki platform/dizilim/metinle doğrudan paylaşılabilir.
    const publishLater = draft.status === "APPROVED" && draft.publish;
    const summary = (
      <PublishedSummary
        status={draft.status}
        reviewedAt={draft.reviewedAt}
        caption={draft.caption}
        media={draft.media}
        publish={draft.publish}
        published={draft.published}
        downloadName={downloadName}
      />
    );
    if (!publishLater) return summary;
    const targets = await getPublishTargets();
    return (
      <div className="flex flex-col gap-3">
        {summary}
        <PublishNow
          id={draft.id}
          platform={publishLater.platform}
          layout={publishLater.layout}
          mediaOrder={publishLater.mediaOrder}
          caption={draft.caption}
          target={targets[publishLater.platform]}
          blocked={false}
        />
      </div>
    );
  }
  return (
    <PublishingHub
      id={draft.id}
      caption={draft.caption}
      media={draft.media}
      format={format}
      postOptions={postOptions}
      currentPostId={draft.postId}
      aiAvailable={isAnthropicConfigured()}
      downloadName={downloadName}
      targets={await getPublishTargets()}
    />
  );
}
