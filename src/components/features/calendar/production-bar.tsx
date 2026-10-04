import { cn } from "@/lib/utils";
import type { ProductionSummary } from "@/lib/calendar/content-progress";

interface ProductionBarProps {
  summary: ProductionSummary;
  className?: string;
}

/** İnce iki renkli ilerleme çubuğu: yeşil = onaylı, amber = onay bekleyen taslak. */
export function ProductionBar({ summary, className }: ProductionBarProps) {
  const pct = (value: number) => `${(value / Math.max(1, summary.total)) * 100}%`;
  return (
    <div
      className={cn("flex h-1 overflow-hidden rounded-full bg-white/[0.08]", className)}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={summary.total}
      aria-valuenow={summary.approved}
      aria-label={`${summary.approved}/${summary.total} içerik hazır`}
    >
      <span className="h-full bg-emerald-400" style={{ width: pct(summary.approved) }} />
      <span className="h-full bg-amber-400/80" style={{ width: pct(summary.draft) }} />
    </div>
  );
}
