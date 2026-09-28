import { cn } from "@/lib/utils";
import type { AiContentStatus } from "@/types/ai-content";

const STATUS_META: Record<AiContentStatus, { label: string; className: string }> = {
  DRAFT: { label: "Onay bekliyor", className: "bg-amber-500/15 text-amber-300 ring-amber-500/30" },
  APPROVED: { label: "Onaylandı", className: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30" },
  REJECTED: { label: "Reddedildi", className: "bg-rose-500/15 text-rose-300 ring-rose-500/30" },
};

export function DraftStatusBadge({ status, className }: { status: AiContentStatus; className?: string }) {
  const meta = STATUS_META[status];
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center rounded-full px-2 py-0.5 text-[10px] font-medium ring-1",
        meta.className,
        className,
      )}
    >
      {meta.label}
    </span>
  );
}
