"use client";

import { AlertCircle, CheckCircle2, RefreshCw } from "lucide-react";
import { syncMetricsAction } from "@/app/dashboard/analytics/actions";
import { Button } from "@/components/ui/button";
import { useActionForm } from "@/hooks/use-action-form";
import type { SocialActionState } from "@/types/social";

const INITIAL_STATE: SocialActionState = {};

/** Bağlı hesaplardan metrikleri şimdi çeker (kademeli takvime göre; "tümü" ile zorla). */
export function SyncMetricsForm({ disabled }: { disabled: boolean }) {
  const { state, isPending, onSubmit } = useActionForm(syncMetricsAction, INITIAL_STATE);

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="sm" disabled={disabled || isPending}>
          <RefreshCw className={isPending ? "animate-spin" : undefined} />
          {isPending ? "Senkronize ediliyor…" : "Metrikleri senkronize et"}
        </Button>
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <input type="checkbox" name="force" className="accent-emerald-500" disabled={disabled || isPending} />
          Takvimi yok say, tümünü çek
        </label>
      </div>
      {state.error ? (
        <p className="flex items-start gap-1.5 text-xs text-destructive" role="alert">
          <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
          {state.error}
        </p>
      ) : null}
      {state.notice ? (
        <p className="flex items-center gap-1.5 text-xs text-emerald-400" role="status">
          <CheckCircle2 className="size-3.5 shrink-0" />
          {state.notice}
        </p>
      ) : null}
    </form>
  );
}
