"use client";

import { LoaderCircle } from "lucide-react";
import type { JobProgress } from "@/hooks/use-action-form";

/** Arka plan işinin adımı: "Fotoğraf büyütülüyor (Fal ESRGAN) · 14 sn". Sayfa kapansa da iş sunucuda sürer. */
export function JobProgressLine({ progress }: { progress: JobProgress | null }) {
  if (!progress) return null;
  return (
    <p className="flex items-center gap-1.5 text-xs text-muted-foreground" role="status" aria-live="polite">
      <LoaderCircle className="size-3.5 shrink-0 animate-spin" />
      {progress.step}
      {progress.elapsedMs >= 1000 ? ` · ${Math.round(progress.elapsedMs / 1000)} sn` : ""}
      <span className="text-[11px] text-muted-foreground/70">— sayfayı kapatsanız da iş sürer, taslak Maç Merkezi&apos;nde görünür</span>
    </p>
  );
}
