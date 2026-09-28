"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle } from "lucide-react";
import { updateSocialPostAction } from "@/app/dashboard/calendar/actions";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useActionForm } from "@/hooks/use-action-form";
import type { FixtureOption, SocialActionState, SocialPostView } from "@/types/social";
import { PostFields, type PostFieldDefaults } from "./post-fields";

interface EditPostSheetProps {
  post: SocialPostView;
  fixtures: FixtureOption[];
  /** Sayfa `?edit=<id>` ile sunucuda açar; kapatmak bu adrese gitmektir. */
  closeHref: string;
}

const INITIAL_STATE: SocialActionState = {};

function toDatetimeLocal(iso: string): string {
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function EditPostSheet({ post, fixtures, closeHref }: EditPostSheetProps) {
  const router = useRouter();
  const { state, isPending, onSubmit } = useActionForm(updateSocialPostAction, INITIAL_STATE);

  useEffect(() => {
    if (state.success) router.push(closeHref);
  }, [state, router, closeHref]);

  // Seçilebilir pencerede (yaklaşan 7 gün) olmayan, ör. geçmiş bir maça bağlı gönderi de seçili kalabilsin.
  const options = fixtures.some((fixture) => fixture.id === post.fixtureId)
    ? fixtures
    : [{ id: post.fixtureId, label: post.fixtureId }, ...fixtures];

  const defaults: PostFieldDefaults = {
    fixtureId: post.fixtureId,
    platformType: post.platform.type,
    scheduledFor: toDatetimeLocal(post.scheduledFor),
    caption: post.caption,
    status: post.status,
  };

  return (
    <Sheet open onOpenChange={(open) => (open ? undefined : router.push(closeHref))}>
      <SheetContent className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Gönderiyi Düzenle</SheetTitle>
          <SheetDescription>Tarih, platform, metin ve durumu güncelleyin.</SheetDescription>
        </SheetHeader>

        <form onSubmit={onSubmit} className="flex flex-col gap-3.5 px-4 pb-4">
          <input type="hidden" name="postId" value={post.id} />
          <PostFields fixtures={options} defaults={defaults} showStatus />

          {state.error ? (
            <p className="flex items-center gap-1.5 text-xs text-destructive" role="alert">
              <AlertCircle className="size-3.5 shrink-0" />
              {state.error}
            </p>
          ) : null}

          <div className="flex gap-2">
            <Button type="submit" disabled={isPending} className="flex-1">
              {isPending ? "Kaydediliyor…" : "Kaydet"}
            </Button>
            <Button type="button" variant="outline" onClick={() => router.push(closeHref)}>
              Vazgeç
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
