import { CopyTextButton } from "@/components/features/dashboard/copy-text-button";
import { DraftDecisionForm } from "@/components/features/dashboard/draft-decision-form";
import { DraftPreview } from "@/components/features/dashboard/draft-preview";
import { DraftStatusBadge } from "@/components/features/dashboard/draft-status-badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { StudioPostOption } from "@/types/ai-content";
import type { LineupDraftView as LineupDraft } from "@/types/draft";

const CARD_SIZE = { width: 1080, height: 1350 } as const;

/**
 * Muhtemel 11 taslağının incelemesi: iki takımın kadro kartı yan yana, gönderi metni ve onay/ret.
 * Kartlar programatiktir — düzenleme stüdyoda yapılır (yeniden kaydetmek yeni taslak üretir).
 */
export function LineupDraftView({ draft, postOptions }: { draft: LineupDraft; postOptions: StudioPostOption[] }) {
  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <CardTitle>{draft.headline} Kartları</CardTitle>
            <DraftStatusBadge status={draft.status} />
          </div>
          <CardDescription>Her takım için ayrı kart · 1080×1350 (IG 4:5) — carousel olarak birlikte paylaşılır.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-2">
          {(["home", "away"] as const).map((side) => (
            <div key={side} className="flex flex-col gap-2">
              <p className="text-sm font-medium">
                {draft[side].teamName}{" "}
                <span className="text-muted-foreground">
                  · {draft[side].formation} · {side === "home" ? "Ev sahibi" : "Deplasman"}
                </span>
              </p>
              <DraftPreview
                url={draft[side].imageUrl}
                {...CARD_SIZE}
                alt={`${draft[side].teamName} muhtemel 11 kartı`}
                downloadName={`checkmatch-11-${side}-${draft.id}`}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
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
