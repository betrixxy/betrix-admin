import Link from "next/link";
import { ClipboardCheck } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { getContentType } from "@/lib/dashboard/content-types";
import { cn } from "@/lib/utils";

/**
 * Tahmin Karnesi B'nin (dönem: hafta / ay / sezon) ana girişi (AI İçerik Stüdyosu): dönem karnesi bir maça bağlı
 * değildir. Maç Merkezi'ndeki "Tahmin Karnesi" seçeneği aynı stüdyoyu maçla (A) açar.
 */
export function ScorecardEntryCard() {
  const type = getContentType("PREDICTION_SCORECARD");
  if (type?.status !== "active") return null;
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border/60 px-4 py-3">
      <ClipboardCheck className="size-5 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{type.label} · dönem (hafta / ay / sezon)</p>
        <p className="text-xs text-muted-foreground">Onaylanan bütün tahminlerin isabet karnesi — tutmayanlar dahil, seçme yok.</p>
      </div>
      <Link href={type.route} className={cn(buttonVariants({ size: "sm", variant: "outline" }))}>
        Dönem karnesini aç
      </Link>
    </div>
  );
}
