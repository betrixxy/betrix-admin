import { AlertTriangle } from "lucide-react";

/** Taslağın stüdyo notları (kart üretildi ama admin bilmeli) — `lib/dashboard/draft-notes.ts`. */
export function DraftStudioNotes({ notes }: { notes: string[] }) {
  if (notes.length === 0) return null;
  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300" role="note">
      {notes.map((note) => (
        <span key={note} className="flex items-start gap-2.5">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          {note}
        </span>
      ))}
    </div>
  );
}
