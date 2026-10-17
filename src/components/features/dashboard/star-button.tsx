"use client";

import { useOptimistic, useState, useTransition } from "react";
import { Star } from "lucide-react";
import { toggleWatchAction } from "@/app/dashboard/plan/watch-actions";
import { cn } from "@/lib/utils";

/**
 * Maç satırındaki yıldız (☆/★) — İçerik Planı'na ekler/çıkarır. Optimistic: tıklayınca hemen
 * dolar/boşalır; sunucu reddederse eski haline döner ve sebep `title`'da görünür.
 */
export function StarButton({ fixtureId, starred, label }: { fixtureId: string; starred: boolean; label: string }) {
  const [optimistic, setOptimistic] = useOptimistic(starred);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const toggle = () => {
    const next = !optimistic;
    setError(null);
    startTransition(async () => {
      setOptimistic(next);
      const result = await toggleWatchAction({ fixtureId, starred: next });
      if (!result.ok) setError(result.error);
    });
  };

  const title = error ?? (optimistic ? `${label} — İçerik Planı'ndan çıkar` : `${label} — İçerik Planı'na ekle`);
  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={optimistic}
      aria-label={title}
      title={title}
      disabled={pending}
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-md transition-colors hover:bg-white/[0.06]",
        error ? "text-destructive" : optimistic ? "text-amber-400" : "text-muted-foreground hover:text-white",
      )}
    >
      <Star className={cn("size-4", optimistic && "fill-current")} />
    </button>
  );
}
