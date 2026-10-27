"use client";

import { AlertTriangle, CheckCircle2, Clock, GitCompare, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DrawComparison } from "@/lib/dashboard/draw-engine";

/**
 * Kura sonrası API karşılaştırması: girilen eşleşmeler ile API fikstürü. Fark varsa uyarı — otomatik
 * düzeltme YOK; admin farkı stüdyoda elle düzeltir ya da kartı olduğu gibi bırakır.
 */
export function DrawCompare({ results, busy, onCompare }: { results: DrawComparison[] | null; busy: boolean; onCompare: () => void }) {
  const differences = results?.reduce((sum, result) => sum + result.differences.length, 0) ?? 0;
  return (
    <div className={differences ? "flex flex-col gap-2 rounded-lg border border-amber-500/50 bg-amber-500/10 p-3" : "flex flex-col gap-2 rounded-lg border border-border/60 p-3"}>
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-sm font-medium">
          {differences ? <AlertTriangle className="size-4 text-amber-400" /> : <GitCompare className="size-4 text-muted-foreground" />}
          Kura sonrası API karşılaştırması
        </span>
        <Button type="button" size="sm" variant="outline" onClick={onCompare} disabled={busy}>
          {busy ? <LoaderCircle className="animate-spin" /> : <GitCompare />}
          Karşılaştır
        </Button>
      </div>
      {results?.map((result) => (
        <div key={result.label} className="flex flex-col gap-1 text-sm">
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {result.pending ? <Clock className="size-3.5" /> : result.differences.length ? <AlertTriangle className="size-3.5 text-amber-400" /> : <CheckCircle2 className="size-3.5 text-emerald-400" />}
            {result.label} — {result.pending ? "API'de bu turun fikstürü henüz yok" : result.differences.length ? `${result.differences.length} fark (otomatik düzeltilmez)` : "fark yok"}
          </span>
          {result.differences.length ? (
            <ul className="ml-5 list-disc text-amber-100/90">
              {result.differences.map((difference) => (
                <li key={difference.text}>{difference.text}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ))}
    </div>
  );
}
