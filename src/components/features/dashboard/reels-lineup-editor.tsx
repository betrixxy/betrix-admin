"use client";

import { useState } from "react";
import { saveReelLineupAction, type ReelActionState } from "@/app/dashboard/studio/reels/actions";
import { Button } from "@/components/ui/button";
import { useSafeActionState } from "@/hooks/use-action-form";
import { formationLines, formationSlots, zoneOfLine } from "@/lib/reels/lineup-rule";
import type { LineupEditorView } from "@/lib/reels/lineup-view";

const INITIAL: ReelActionState = {};
const FIELD = "w-full rounded-md border border-border bg-transparent px-2 py-1.5 text-sm text-white";

/** Muhtemel 11'i düzenle: diziliş + 11 yer, seçenekler güncel kadro. Boş bırakılan yer videoda "?" görünür. */
export function ReelsLineupEditor({ projectId, editor, disabledReason }: { projectId: string; editor: LineupEditorView; disabledReason: string | null }) {
  const [state, action, isPending] = useSafeActionState(saveReelLineupAction, INITIAL);
  const [formation, setFormation] = useState(editor.formation);
  const lines = formationLines(formation) ?? [1, 4, 2, 3, 1];
  const disabled = disabledReason !== null;
  return (
    <details className="rounded-md border border-border/60 p-3">
      <summary className="cursor-pointer text-sm text-white">{editor.teamName}: Muhtemel 11&apos;i düzenle{editor.edited ? " (düzenlendi)" : ""}</summary>
      <form action={action} className="mt-3 flex flex-col gap-2">
        <input type="hidden" name="projectId" value={projectId} />
        <input type="hidden" name="side" value={editor.side} />
        {editor.notes.map((note) => <p key={note} className="text-xs text-amber-200">{note}</p>)}
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Diziliş
          <select name="formation" value={formation} onChange={(event) => setFormation(event.target.value)} disabled={disabled} className={FIELD}>
            {editor.formations.map((item) => <option key={item} value={item} className="bg-background">{item}</option>)}
          </select>
        </label>
        {formationSlots(lines).map((place, slot) => (
          <label key={slot} className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="w-16 shrink-0">{zoneOfLine(place.line, lines.length)}</span>
            <select name={`slot${slot}`} defaultValue={editor.playerIds[slot] ?? ""} disabled={disabled} className={FIELD}>
              <option value="" className="bg-background">? (belirsiz)</option>
              {editor.squad.map((player) => <option key={player.id} value={player.id} className="bg-background">{player.label}</option>)}
            </select>
          </label>
        ))}
        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" variant="secondary" disabled={isPending || disabled}>{isPending ? "Kaydediliyor…" : "Kaydet"}</Button>
          {editor.edited ? <Button type="submit" name="reset" value="1" variant="ghost" disabled={isPending || disabled}>Son maça dön</Button> : null}
          {disabledReason ? <span className="text-xs text-muted-foreground">{disabledReason}</span> : null}
          {state.error ? <span className="text-xs text-amber-300">{state.error}</span> : null}
          {state.message ? <span className="text-xs text-emerald-300">{state.message}</span> : null}
        </div>
      </form>
    </details>
  );
}
