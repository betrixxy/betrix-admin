"use client";

import { useActionState } from "react";
import { RefreshCw } from "lucide-react";
import { refreshPostMetricsAction } from "@/app/dashboard/posts/actions";
import { Button } from "@/components/ui/button";
import type { SocialActionState } from "@/types/social";
import { ActionNotice } from "./action-notice";

const INITIAL: SocialActionState = {};

/** "Şimdi güncelle" (tek gönderi) / "Tümünü şimdi güncelle" — admin tıklamasıyla, salt okuma. */
export function RefreshMetricsButton({ postId, label }: { postId?: string; label: string }) {
  const [state, action, isPending] = useActionState(refreshPostMetricsAction, INITIAL);
  return (
    <form action={action} className="flex flex-col gap-1.5">
      {postId ? <input type="hidden" name="postId" value={postId} /> : null}
      <Button type="submit" variant="outline" disabled={isPending} className="self-start">
        <RefreshCw className={isPending ? "size-3.5 animate-spin" : "size-3.5"} />
        {isPending ? "Güncelleniyor…" : label}
      </Button>
      <ActionNotice state={state} />
    </form>
  );
}
