"use client";

import { useActionState } from "react";
import { RotateCcw } from "lucide-react";
import { retryFailedJobsAction } from "@/app/dashboard/analytics/actions";
import { Button } from "@/components/ui/button";
import type { SocialActionState } from "@/types/social";
import { ActionNotice } from "./posts/action-notice";

const INITIAL: SocialActionState = {};

export function RetryJobsButton() {
  const [state, action, isPending] = useActionState(retryFailedJobsAction, INITIAL);
  return (
    <form action={action} className="flex flex-col gap-1.5">
      <Button type="submit" size="sm" variant="outline" disabled={isPending} className="self-start">
        <RotateCcw className="size-3.5" />
        Başarısız işleri yeniden dene
      </Button>
      <ActionNotice state={state} />
    </form>
  );
}
