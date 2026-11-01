"use client";

import { AlertCircle, Check, Plus, Snowflake } from "lucide-react";
import { freezeReelSnapshotAction, selectReelMatchAction, type ReelActionState } from "@/app/dashboard/studio/reels/actions";
import { Button } from "@/components/ui/button";
import { useSafeActionState } from "@/hooks/use-action-form";

const INITIAL: ReelActionState = {};

function Feedback({ state }: { state: ReelActionState }) {
  if (state.error) {
    return (
      <p className="flex items-center gap-1.5 text-xs text-destructive" role="alert">
        <AlertCircle className="size-3.5 shrink-0" />
        {state.error}
      </p>
    );
  }
  return state.message ? <p className="text-xs text-muted-foreground">{state.message}</p> : null;
}

export function SelectMatchButton({ matchId, selected }: { matchId: number; selected: boolean }) {
  const [state, action, isPending] = useSafeActionState(selectReelMatchAction, INITIAL);
  if (selected) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-emerald-300">
        <Check className="size-3.5" />
        Seçili
      </span>
    );
  }
  return (
    <form action={action} className="flex flex-col items-end gap-1">
      <input type="hidden" name="matchId" value={matchId} />
      <Button type="submit" size="sm" variant="outline" disabled={isPending}>
        <Plus />
        {isPending ? "Seçiliyor…" : "Seç"}
      </Button>
      <Feedback state={state} />
    </form>
  );
}

export function FreezeButton({ projectId, hasSnapshot, disabledReason }: { projectId: string; hasSnapshot: boolean; disabledReason: string | null }) {
  const [state, action, isPending] = useSafeActionState(freezeReelSnapshotAction, INITIAL);
  return (
    <form action={action} className="flex flex-col items-end gap-1">
      <input type="hidden" name="projectId" value={projectId} />
      <Button type="submit" disabled={isPending || disabledReason !== null} title={disabledReason ?? undefined}>
        <Snowflake />
        {isPending ? "Donduruluyor…" : hasSnapshot ? "Yeniden dondur" : "Veriyi dondur"}
      </Button>
      {disabledReason ? <p className="text-xs text-muted-foreground">{disabledReason}</p> : null}
      <Feedback state={state} />
    </form>
  );
}
