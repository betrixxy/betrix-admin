import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string;
  hint?: string;
  icon: LucideIcon;
  /** Tailwind renk sınıfları — ikon kutusunun arka plan ve metin rengi. */
  accentClassName?: string;
}

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  accentClassName = "bg-emerald-500/15 text-emerald-400",
}: StatCardProps) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-xs text-muted-foreground">{label}</span>
          <span className="text-2xl font-semibold tracking-tight text-white tabular-nums">
            {value}
          </span>
          {hint ? <span className="truncate text-[11px] text-muted-foreground">{hint}</span> : null}
        </div>
        <div className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", accentClassName)}>
          <Icon className="size-4" />
        </div>
      </CardContent>
    </Card>
  );
}
