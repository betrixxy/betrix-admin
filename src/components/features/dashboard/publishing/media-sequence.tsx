"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, GripVertical, X } from "lucide-react";
import { RenderThumbnail } from "@/components/features/dashboard/render-thumbnail";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PublishMedia } from "@/types/publishing";

/** Bir öğeyi `from` konumundan `to` konumuna taşır (yeni dizi). */
function move<T>(items: T[], from: number, to: number): T[] {
  const next = [...items];
  const [item] = next.splice(from, 1);
  if (item !== undefined) next.splice(to, 0, item);
  return next;
}

/** Medya dizilimi: sürükle-bırak ya da oklarla sıra — ilk görsel kapak/ilk kare olur; galeriden eklenenler çıkarılabilir. */
export function MediaSequence({ items, onChange, disabled }: { items: PublishMedia[]; onChange: (items: PublishMedia[]) => void; disabled?: boolean }) {
  const [dragging, setDragging] = useState<number | null>(null);
  return (
    <ol className="flex flex-col gap-2" aria-label="Medya dizilimi">
      {items.map((item, index) => (
        <li
          key={item.url}
          draggable={!disabled}
          onDragStart={() => setDragging(index)}
          onDragEnd={() => setDragging(null)}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            if (dragging !== null && dragging !== index) onChange(move(items, dragging, index));
            setDragging(null);
          }}
          className={cn(
            "flex items-center gap-3 rounded-lg border border-border/60 bg-white/[0.02] p-2 transition-colors",
            dragging === index && "opacity-50",
            !disabled && "cursor-grab active:cursor-grabbing",
          )}
        >
          <GripVertical className="size-4 shrink-0 text-muted-foreground" />
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-xs font-semibold text-emerald-300">{index + 1}</span>
          <div className="size-12 shrink-0 overflow-hidden rounded-md bg-muted/30 ring-1 ring-border">
            <RenderThumbnail src={item.url} alt={item.label} iconClassName="size-4" />
          </div>
          <span className="min-w-0 flex-1 truncate text-sm">
            {item.label}
            {item.fromGallery ? <span className="ml-2 rounded bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-muted-foreground">Galeri</span> : null}
          </span>
          <div className="flex gap-1">
            <Button type="button" size="icon" variant="ghost" className="size-7" disabled={disabled || index === 0} onClick={() => onChange(move(items, index, index - 1))} aria-label="Yukarı taşı">
              <ArrowUp />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="size-7"
              disabled={disabled || index === items.length - 1}
              onClick={() => onChange(move(items, index, index + 1))}
              aria-label="Aşağı taşı"
            >
              <ArrowDown />
            </Button>
            {item.fromGallery ? (
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="size-7 text-muted-foreground hover:text-destructive"
                disabled={disabled}
                onClick={() => onChange(items.filter((candidate) => candidate.url !== item.url))}
                aria-label="Dizilimden çıkar"
              >
                <X />
              </Button>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
