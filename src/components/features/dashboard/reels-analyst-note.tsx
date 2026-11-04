"use client";

import { saveReelAnalystNoteAction, type ReelActionState } from "@/app/dashboard/studio/reels/actions";
import { Button } from "@/components/ui/button";
import { useSafeActionState } from "@/hooks/use-action-form";
import { SCREEN_NOTE_MAX_CHARS, SCREEN_NOTE_MAX_WORDS, VOICE_NOTE_MAX_CHARS } from "@/lib/reels/analyst-note";

const INITIAL: ReelActionState = {};

/** Kullanıcının kendi futbol okuması: "Maçın anahtarı" ve "checkmatch senaryosu" kartlarına girer; boşsa veri yorumu kullanılır. */
export function ReelsAnalystNote({ projectId, screenNote, voiceNote, disabledReason }: { projectId: string; screenNote: string | null; voiceNote: string | null; disabledReason: string | null }) {
  const [state, action, isPending] = useSafeActionState(saveReelAnalystNoteAction, INITIAL);
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="projectId" value={projectId} />
      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        Ekran özeti (kartta görünür)
        <input name="screen" autoComplete="off" defaultValue={screenNote ?? ""} maxLength={SCREEN_NOTE_MAX_CHARS} disabled={disabledReason !== null} placeholder={`En fazla ${SCREEN_NOTE_MAX_WORDS} sözcük. Boşsa veri tabanlı yorum görünür.`} className="w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm text-white placeholder:text-muted-foreground" />
      </label>
      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        Seslendirme notu (okunur, video açıklamasına girer)
        <textarea name="voice" autoComplete="off" defaultValue={voiceNote ?? ""} maxLength={VOICE_NOTE_MAX_CHARS} rows={3} disabled={disabledReason !== null} placeholder="1–3 cümle. Boş bırakılabilir." className="w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm text-white placeholder:text-muted-foreground" />
      </label>
      <div className="flex items-center gap-3">
        <Button type="submit" variant="secondary" disabled={isPending || disabledReason !== null}>{isPending ? "Kaydediliyor…" : "Notu kaydet"}</Button>
        {disabledReason ? <span className="text-xs text-muted-foreground">{disabledReason}</span> : null}
        {state.error ? <span className="text-xs text-amber-300">{state.error}</span> : null}
        {state.message ? <span className="text-xs text-emerald-300">{state.message}</span> : null}
      </div>
    </form>
  );
}
