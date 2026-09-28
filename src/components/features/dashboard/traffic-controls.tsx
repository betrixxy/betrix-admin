import Link from "next/link";
import { cn } from "@/lib/utils";
import { TRAFFIC_GRANULARITIES, TRAFFIC_RANGES, type TrafficGranularity, type TrafficRange } from "@/types/traffic";

const GRANULARITY_LABELS: Record<TrafficGranularity, string> = { day: "Günlük", week: "Haftalık" };

export function trafficHref(range: TrafficRange, granularity: TrafficGranularity): string {
  return `/dashboard/traffic?range=${range}&by=${granularity}`;
}

interface TrafficControlsProps {
  range: TrafficRange;
  granularity: TrafficGranularity;
}

function Segment({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center gap-1 rounded-lg bg-muted/50 p-1">{children}</div>;
}

function segmentClass(active: boolean): string {
  return cn(
    "rounded-md px-3 py-1 text-xs font-medium transition-colors",
    active ? "bg-card text-white shadow-sm" : "text-muted-foreground hover:text-white",
  );
}

/** Dönem (7/30/90 gün) ve gruplama (günlük/haftalık) seçimi — URL tabanlı, istemci durumu yok. */
export function TrafficControls({ range, granularity }: TrafficControlsProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Segment>
        {TRAFFIC_RANGES.map((option) => (
          <Link key={option} href={trafficHref(option, granularity)} className={segmentClass(option === range)}>
            Son {option} gün
          </Link>
        ))}
      </Segment>
      <Segment>
        {TRAFFIC_GRANULARITIES.map((option) => (
          <Link key={option} href={trafficHref(range, option)} className={segmentClass(option === granularity)}>
            {GRANULARITY_LABELS[option]}
          </Link>
        ))}
      </Segment>
    </div>
  );
}
