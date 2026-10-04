"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle } from "lucide-react";
import { updatePostAnalyticsAction } from "@/app/dashboard/analytics/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useActionForm } from "@/hooks/use-action-form";
import type { SocialActionState, SocialPostView } from "@/types/social";

interface EditMetricsSheetProps {
  post: SocialPostView;
  postLabel: string;
  closeHref: string;
}

const INITIAL_STATE: SocialActionState = {};

const FIELDS = [
  { name: "views", label: "İzlenme" },
  { name: "reach", label: "Erişim (tekil hesap)" },
  { name: "impressions", label: "Gösterim" },
  { name: "likes", label: "Beğeni" },
  { name: "comments", label: "Yorum" },
  { name: "shares", label: "Paylaşım" },
  { name: "saves", label: "Kaydetme" },
] as const;

/** API'si bağlanmamış platformlar için metrikleri elle girmek; bağlı platformlarda senkronizasyon ezer. */
export function EditMetricsSheet({ post, postLabel, closeHref }: EditMetricsSheetProps) {
  const router = useRouter();
  const { state, isPending, onSubmit } = useActionForm(updatePostAnalyticsAction, INITIAL_STATE);

  useEffect(() => {
    if (state.success) router.push(closeHref);
  }, [state, router, closeHref]);

  return (
    <Sheet open onOpenChange={(open) => (open ? undefined : router.push(closeHref))}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Metrik Gir</SheetTitle>
          <SheetDescription>
            {postLabel} · {post.platform.displayName}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={onSubmit} className="flex flex-col gap-3.5 overflow-y-auto px-4 pb-4">
          <input type="hidden" name="postId" value={post.id} />
          {FIELDS.map((field) => (
            <div key={field.name} className="flex flex-col gap-1.5">
              <Label htmlFor={field.name}>{field.label}</Label>
              <Input
                id={field.name}
                name={field.name}
                type="number"
                min={0}
                step={1}
                required
                defaultValue={post.analytics?.[field.name] ?? 0}
              />
            </div>
          ))}

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
