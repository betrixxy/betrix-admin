import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ComparisonMetric {
  id: string;
  label: string;
  homePlaceholder: string;
  awayPlaceholder: string;
}

const METRICS: ComparisonMetric[] = [
  {
    id: "possession",
    label: "Top Hakimiyeti (%)",
    homePlaceholder: "58",
    awayPlaceholder: "42",
  },
  {
    id: "shots",
    label: "Toplam Şut",
    homePlaceholder: "14",
    awayPlaceholder: "9",
  },
  {
    id: "shots-on-target",
    label: "İsabetli Şut",
    homePlaceholder: "6",
    awayPlaceholder: "3",
  },
  {
    id: "dangerous-attacks",
    label: "Tehlikeli Atak (maç başı)",
    homePlaceholder: "48",
    awayPlaceholder: "35",
  },
  {
    id: "xg",
    label: "xG",
    homePlaceholder: "1.8",
    awayPlaceholder: "1.1",
  },
  {
    id: "form",
    label: "Son 5 Maç Form",
    homePlaceholder: "G-G-B-G-M",
    awayPlaceholder: "M-G-G-B-G",
  },
];

export function TeamAnalysisForm() {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-[1fr_88px_88px] items-center gap-2 px-0.5">
        <span />
        <span className="text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Ev Sahibi
        </span>
        <span className="text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Deplasman
        </span>
      </div>

      <div className="flex flex-col divide-y divide-border rounded-lg border border-border">
        {METRICS.map((metric) => (
          <div
            key={metric.id}
            className="grid grid-cols-[1fr_88px_88px] items-center gap-2 px-3 py-2.5"
          >
            <Label htmlFor={`${metric.id}-home`} className="text-xs font-normal text-white/70">
              {metric.label}
            </Label>
            <Input
              id={`${metric.id}-home`}
              placeholder={metric.homePlaceholder}
              className="h-8 text-center text-xs"
            />
            <Input
              id={`${metric.id}-away`}
              placeholder={metric.awayPlaceholder}
              className="h-8 text-center text-xs"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
