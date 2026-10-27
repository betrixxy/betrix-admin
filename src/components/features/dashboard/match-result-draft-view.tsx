import { DraftPublishPanel } from "@/components/features/dashboard/publishing/draft-publish-panel";
import { CONTENT_MAX_HASHTAGS } from "@/lib/dashboard/publish-caption";
import { DraftPreview } from "@/components/features/dashboard/draft-preview";
import { DraftStatusBadge } from "@/components/features/dashboard/draft-status-badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { StudioPostOption } from "@/types/ai-content";
import type { MatchResultDraftView as MatchResultDraft } from "@/types/draft";
import { SOCIAL_FORMATS, socialFormatCaption } from "@/types/studio-formats";

/**
 * Maç sonrası set taslağının incelemesi: kart(lar), gönderi metni ve onay/ret. Carousel'de (01 Maç
 * Sonucu + 02 İstatistikler) iki görsel yayın sırasıyla yan yana gösterilir; Yayın Merkezi de bu
 * sırayla dizer. Kart değişikliği stüdyoda yapılır (yeniden üretmek yeni bir taslak açar).
 */
export function MatchResultDraftView({ draft, postOptions }: { draft: MatchResultDraft; postOptions: StudioPostOption[] }) {
  const frame = SOCIAL_FORMATS[draft.format];
  const carousel = draft.slides.length > 1;
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <CardTitle>{draft.title}</CardTitle>
            <DraftStatusBadge status={draft.status} />
          </div>
          <CardDescription>
            {draft.kindLabel} · {draft.subtitle}
            {draft.mvpName ? ` · Maçın oyuncusu: ${draft.mvpName}` : ""} · {socialFormatCaption(draft.format)}
            {carousel ? ` · Carousel (${draft.slides.length} görsel)` : ""}
          </CardDescription>
        </CardHeader>
        <CardContent className={carousel ? "grid gap-4 sm:grid-cols-2" : undefined}>
          {draft.slides.map((slide, index) => (
            <div key={slide.url} className="flex flex-col gap-1.5">
              {carousel ? (
                <span className="text-xs text-muted-foreground">
                  {index + 1}/{draft.slides.length} · {slide.label}
                </span>
              ) : null}
              <DraftPreview url={slide.url} width={frame.width} height={frame.height} alt={`${draft.title} · ${slide.label}`} downloadName={`checkmatch-${draft.id}-${index + 1}`} />
            </div>
          ))}
        </CardContent>
      </Card>

      <DraftPublishPanel draft={draft} format={draft.format} postOptions={postOptions} downloadName={`checkmatch-${draft.slug}-${draft.id}`} vitrin={draft.vitrin} languageGate={draft.languageGate} maxHashtags={draft.slug === "kura" ? CONTENT_MAX_HASHTAGS.DRAWS_AND_PAIRINGS : null} />
    </div>
  );
}
