"use client";

import { LayoutGrid, UserRound } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { LINEUP_TEMPLATE_LABELS, LINEUP_TEMPLATE_STYLES, type LineupTemplateStyle } from "@/types/lineup";

const DESCRIPTIONS: Record<LineupTemplateStyle, string> = {
  pitch: "Lacivert-yeşil saha üzerinde diziliş — kapak fotoğrafı gerekmez.",
  hero_list: "Solda kapak oyuncusu (Fal.ai kesimi), sağda numara + isim listesi.",
};

const ICONS = { pitch: LayoutGrid, hero_list: UserRound } as const satisfies Record<LineupTemplateStyle, unknown>;

/** Kart şablonu seçimi — iki takımın kartı da seçilen şablonla çizilir. */
export function LineupTemplatePicker({ value, onChange }: { value: LineupTemplateStyle; onChange: (value: LineupTemplateStyle) => void }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Kart Şablonu</CardTitle>
        <CardDescription>İki takımın kartı da seçilen şablonla çizilir.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Kart şablonu">
          {LINEUP_TEMPLATE_STYLES.map((style) => {
            const Icon = ICONS[style];
            const selected = value === style;
            return (
              <button
                key={style}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => onChange(style)}
                className={cn(
                  "flex items-start gap-3 rounded-lg border p-3 text-left transition-colors",
                  selected ? "border-emerald-400/70 bg-emerald-400/10" : "border-border/60 hover:bg-white/[0.04]",
                )}
              >
                <Icon className={cn("mt-0.5 size-4 shrink-0", selected ? "text-emerald-300" : "text-muted-foreground")} />
                <span className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium">{LINEUP_TEMPLATE_LABELS[style]}</span>
                  <span className="text-xs text-muted-foreground">{DESCRIPTIONS[style]}</span>
                </span>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
