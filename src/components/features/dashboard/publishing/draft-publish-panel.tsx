import { isAnthropicConfigured } from "@/lib/services/anthropic";
import type { StudioPostOption } from "@/types/ai-content";
import type { AiContentStatus } from "@/types/ai-content";
import type { PublishableDraft } from "@/types/draft";
import type { SocialFormatId } from "@/types/studio-formats";
import { PublishedSummary } from "./published-summary";
import { PublishingHub } from "./publishing-hub";

interface DraftPublishPanelProps {
  draft: PublishableDraft & { id: string; status: AiContentStatus; caption: string; postId: string | null; reviewedAt: string | null };
  format: SocialFormatId | null;
  postOptions: StudioPostOption[];
  downloadName: string;
}

/** Taslak türünden bağımsız yayın paneli: karar bekleyen taslakta Yayın Merkezi, karara bağlanmışta özet. */
export function DraftPublishPanel({ draft, format, postOptions, downloadName }: DraftPublishPanelProps) {
  if (draft.status !== "DRAFT") {
    return <PublishedSummary status={draft.status} reviewedAt={draft.reviewedAt} caption={draft.caption} media={draft.media} publish={draft.publish} downloadName={downloadName} />;
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
    />
  );
}
