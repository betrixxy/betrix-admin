"use client";

import { useState, useTransition } from "react";
import { CircleCheck, Clock, Trash2 } from "lucide-react";
import { deleteSocialPostAction, updateSocialPostStatusAction } from "@/app/dashboard/calendar/actions";
import { Button } from "@/components/ui/button";
import type { SocialPostStatus } from "@/types/social";

interface PostRowActionsProps {
  postId: string;
  status: SocialPostStatus;
}

export function PostRowActions({ postId, status }: PostRowActionsProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(action: () => Promise<{ ok: boolean; error?: { message: string } }>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) setError(result.error?.message ?? "İşlem başarısız.");
    });
  }

  const nextStatus: SocialPostStatus = status === "PREPARING" ? "PUBLISHED" : "PREPARING";

  return (
    <div className="flex items-center justify-end gap-1">
      {error ? <span className="mr-1 text-[11px] text-destructive">{error}</span> : null}
      <Button
        variant="ghost"
        size="xs"
        disabled={isPending}
        onClick={() => run(() => updateSocialPostStatusAction(postId, nextStatus))}
      >
        {status === "PREPARING" ? <CircleCheck /> : <Clock />}
        {status === "PREPARING" ? "Paylaşıldı yap" : "Hazırlanıyor'a al"}
      </Button>
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label="Gönderiyi sil"
        disabled={isPending}
        onClick={() => run(() => deleteSocialPostAction(postId))}
      >
        <Trash2 />
      </Button>
    </div>
  );
}
