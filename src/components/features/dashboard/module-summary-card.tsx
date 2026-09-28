import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowUpRight, type LucideIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface SummaryMetric {
  label: string;
  value: string;
}

interface ModuleSummaryCardProps {
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
  /** İkon kutusunun Tailwind renk sınıfları. */
  accentClassName: string;
  metrics: SummaryMetric[];
  /** Metriklerin altındaki modüle özel içerik (liste, küçük grafik vb.). */
  children?: ReactNode;
}

/** Genel bakış sayfasındaki modül özeti — tüm kart, modüle giden bir bağlantıdır. */
export function ModuleSummaryCard({
  title,
  description,
  href,
  icon: Icon,
  accentClassName,
  metrics,
  children,
}: ModuleSummaryCardProps) {
  return (
    <Card className="transition-shadow hover:ring-foreground/20">
      <CardHeader className="flex-row items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", accentClassName)}>
            <Icon className="size-4" />
          </div>
          <div className="flex flex-col gap-0.5">
            <CardTitle>{title}</CardTitle>
            <CardDescription className="text-xs">{description}</CardDescription>
          </div>
        </div>
        <Link href={href} className="flex items-center gap-1 text-xs text-emerald-400 hover:underline">
          Modüle git <ArrowUpRight className="size-3.5" />
        </Link>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <dl className="grid grid-cols-3 gap-3">
          {metrics.map((metric) => (
            <div key={metric.label} className="flex flex-col gap-0.5 rounded-lg bg-muted/30 px-3 py-2">
              <dt className="truncate text-[11px] text-muted-foreground">{metric.label}</dt>
              <dd className="text-lg font-semibold text-white tabular-nums">{metric.value}</dd>
            </div>
          ))}
        </dl>
        {children}
      </CardContent>
    </Card>
  );
}
