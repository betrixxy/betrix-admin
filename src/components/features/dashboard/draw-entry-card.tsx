import Link from "next/link";
import { Shuffle } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { getContentType } from "@/lib/dashboard/content-types";
import { cn } from "@/lib/utils";

/**
 * Kura Sonucu'nun ana girişi (AI İçerik Stüdyosu): kura bir maça bağlı değildir. Maç Merkezi'ndeki
 * "Kura Sonucu" seçeneği aynı stüdyoyu maçın turnuvasıyla açar (bkz. `drawEntryFromFixture`).
 */
export function DrawEntryCard() {
  const type = getContentType("DRAWS_AND_PAIRINGS");
  if (type?.status !== "active") return null;
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border/60 px-4 py-3">
      <Shuffle className="size-5 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{type.label}</p>
        <p className="text-xs text-muted-foreground">{type.description}</p>
      </div>
      <Link href={type.route} className={cn(buttonVariants({ size: "sm", variant: "outline" }))}>
        Kura stüdyosunu aç
      </Link>
    </div>
  );
}
