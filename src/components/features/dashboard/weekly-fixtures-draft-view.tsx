import { CopyTextButton } from "@/components/features/dashboard/copy-text-button";
import { DraftDecisionForm } from "@/components/features/dashboard/draft-decision-form";
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

      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Gönderi Metni</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <pre className="whitespace-pre-wrap rounded-lg bg-white/[0.03] p-3 font-mono text-xs leading-relaxed text-white">{draft.caption}</pre>
            <CopyTextButton text={draft.caption} />
          </CardContent>
        </Card>

        {draft.status === "DRAFT" ? (
          <DraftDecisionForm id={draft.id} postOptions={postOptions} currentPostId={draft.postId} />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Karar</CardTitle>
              <CardDescription>
                Bu taslak karara bağlandı
                {draft.reviewedAt ? ` (${new Date(draft.reviewedAt).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" })})` : ""} — artık değiştirilemez.
              </CardDescription>
            </CardHeader>
          </Card>
        )}
      </div>
    </div>
  );
}
