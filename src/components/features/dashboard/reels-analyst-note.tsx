"use client";

import { saveReelAnalystNoteAction, type ReelActionState } from "@/app/dashboard/studio/reels/actions";
import { Button } from "@/components/ui/button";
import { useSafeActionState } from "@/hooks/use-action-form";
import { ANALYST_NOTE_MAX } from "@/lib/reels/commentary";

const INITIAL: ReelActionState = {};

/** Kullanıcının kendi futbol okuması. "Maçın anahtarı" ve "checkmatch senaryosu" kartlarına girer; boşsa veri yorumu kullanılır. */
export function ReelsAnalystNote({ projectId, note, disabledReason }: { projectId: string; note: string | null; disabledReason: string | null }) {
  const [state, action, isPending] = useSafeActionState(saveReelAnalystNoteAction, INITIAL);
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="projectId" value={projectId} />
      <textarea name="note" autoComplete="off" defaultValue={note ?? ""} maxLength={ANALYST_NOTE_MAX} rows={3} disabled={disabledReason !== null} placeholder="1–3 cümle. Boş bırakırsanız veri tabanlı yorum kullanılır." className="w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm text-white placeholder:text-muted-foreground" />
      <div className="flex items-center gap-3">
        <Button type="submit" variant="secondary" disabled={isPending || disabledReason !== null}>{isPending ? "Kaydediliyor…" : "Notu kaydet"}</Button>
        {disabledReason ? <span className="text-xs text-muted-foreground">{disabledReason}</span> : null}
        {state.error ? <span className="text-xs text-amber-300">{state.error}</span> : null}
        {state.message ? <span className="text-xs text-emerald-300">{state.message}</span> : null}
      </div>
    </form>
  );
}
