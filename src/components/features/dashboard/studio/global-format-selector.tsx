"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { SOCIAL_FORMAT_IDS, SOCIAL_FORMATS, type SocialFormatId } from "@/types/studio-formats";

/** Oranı küçük bir çerçeve olarak gösterir (en uzun kenar 22px). */
function RatioGlyph({ id, selected }: { id: SocialFormatId; selected: boolean }) {
  const { width, height } = SOCIAL_FORMATS[id];
  const scale = 22 / Math.max(width, height);
  return (
    <span className="flex size-6 shrink-0 items-center justify-center">
      <span
        className={cn("rounded-[3px] border-2", selected ? "border-emerald-300" : "border-muted-foreground/70")}
        style={{ width: Math.round(width * scale), height: Math.round(height * scale) }}
      />
    </span>
  );
}

/**
 * Küresel platform/format seçici — tüm görsel stüdyolar (Muhtemel 11, Haftanın Maçları, Derinlemesine
 * Analiz) aynı bileşeni ve aynı kaydı (`types/studio-formats.ts`) kullanır.
 */
export function GlobalFormatSelector({ value, onChange, disabled }: { value: SocialFormatId; onChange: (value: SocialFormatId) => void; disabled?: boolean }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Platform / Format</CardTitle>
        <CardDescription>Kart seçilen platformun boyutunda çizilir; yerleşim formata göre kendini kurar.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4" role="radiogroup" aria-label="Platform / format">
          {SOCIAL_FORMAT_IDS.map((id) => {
            const format = SOCIAL_FORMATS[id];
            const selected = value === id;
            return (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={disabled}
                onClick={() => onChange(id)}
                className={cn(
                  "flex items-start gap-2.5 rounded-lg border p-3 text-left transition-colors disabled:opacity-50",
                  selected ? "border-emerald-400/70 bg-emerald-400/10" : "border-border/60 hover:bg-white/[0.04]",
                )}
              >
                <RatioGlyph id={id} selected={selected} />
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-sm font-medium">
                    {format.label} <span className="text-muted-foreground">· {format.ratioLabel}</span>
                  </span>
                  <span className="text-xs text-muted-foreground">{format.platforms}</span>
                  <span className="text-[11px] tabular-nums text-muted-foreground/80">
                    {format.width}×{format.height}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
