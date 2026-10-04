"use client";

import { useState } from "react";
import { Coins } from "lucide-react";
import { Label } from "@/components/ui/label";
import { MATCH_DAY_TEMPLATES, RANDOM_TEMPLATE, isMatchDayTemplateId } from "@/lib/dashboard/match-day-templates";
import { cn } from "@/lib/utils";
import type { MatchDayQualityMode } from "@/types/match-day";

const QUALITY_OPTIONS: { id: MatchDayQualityMode; label: string; description: string }[] = [
  {
    id: "PREMIUM",
    label: "Premium",
    description: "Kompozit, Fal.ai image-to-image ile tek bir fotoğraf gibi harmanlanır (+1 ücretli çağrı).",
  },
  {
    id: "ECONOMY",
    label: "Ekonomik",
    description: "Harmanlama atlanır; ışık/gölge yalnızca yerel olarak (sharp) kurulur. Taslak ve hızlı denemeler için.",
  },
];

/**
 * Üst sınır tahmini — önbellekten gelen kesim/arka plan bunu düşürür; gerçek sayı üretimden
 * sonra önizlemede gösterilir. Kesim: en fazla 2 × (upscale + birefnet).
 */
function maxPaidCalls(template: string, quality: MatchDayQualityMode): number {
  const meta = isMatchDayTemplateId(template) ? MATCH_DAY_TEMPLATES[template] : null;
  const background = meta ? (meta.aiBackground ? 1 : 0) : 1;
  const harmonize = quality === "PREMIUM" && (meta ? meta.harmonize : true) ? 1 : 0;
  return 4 + background + harmonize;
}

/** Kalite modu, arka plan önbelleği, harmanlama gücü ve oyuncu koruma — maliyeti doğrudan etkiler. */
export function MatchDayAiSettings({ template }: { template: string }) {
  const [quality, setQuality] = useState<MatchDayQualityMode>("PREMIUM");
  const [strength, setStrength] = useState(0.3);
  const harmonizes = quality === "PREMIUM" && (template === RANDOM_TEMPLATE || !isMatchDayTemplateId(template) || MATCH_DAY_TEMPLATES[template].harmonize);

  return (
    <fieldset className="flex flex-col gap-3 rounded-lg border border-border p-3">
      <legend className="px-1 text-sm font-medium">Kalite ve maliyet</legend>
      <input type="hidden" name="quality" value={quality} />
      <div className="grid gap-2 sm:grid-cols-2">
        {QUALITY_OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => setQuality(option.id)}
            aria-pressed={quality === option.id}
            className={cn(
              "flex flex-col gap-0.5 rounded-lg border p-2.5 text-left transition-colors",
              quality === option.id ? "border-emerald-500/60 bg-emerald-500/10" : "border-border hover:border-white/25",
            )}
          >
            <span className="text-sm font-medium text-white">{option.label}</span>
            <span className="text-[11px] leading-snug text-muted-foreground">{option.description}</span>
          </button>
        ))}
      </div>

      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="reuseBackground" defaultChecked className="mt-1 accent-emerald-500" />
        <span>
          Aynı ayarlar için önceki arka planı yeniden kullan
          <span className="block text-[11px] text-muted-foreground">
            Aynı şablon, format, renk ve tansiyonla daha önce üretilmiş sahne varsa Fal.ai&apos;ye gidilmez. Yeni bir sahne
            için kapatın ya da ek yönerge yazın.
          </span>
        </span>
      </label>

      <div className={cn("grid gap-4 sm:grid-cols-2", !harmonizes && "pointer-events-none opacity-40")}>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="strength">AI harmanlama gücü: {strength.toFixed(2)}</Label>
          <input
            id="strength"
            name="strength"
            type="range"
            min={0.15}
            max={0.6}
            step={0.05}
            value={strength}
            onChange={(event) => setStrength(Number(event.target.value))}
            className="accent-emerald-500"
          />
          <span className="text-[11px] text-muted-foreground">Gerçekçilik için 0.20-0.35 önerilir; yüksek değer yüzleri değiştirebilir.</span>
        </div>
        <label className="flex items-start gap-2 pt-5 text-sm">
          <input type="checkbox" name="preservePlayers" defaultChecked className="mt-1 accent-emerald-500" />
          <span>
            Oyuncuları birebir koru
            <span className="block text-[11px] text-muted-foreground">Harmanlamadan sonra orijinal kesimler tekrar basılır.</span>
          </span>
        </label>
      </div>

      <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Coins className="size-3.5 shrink-0 text-amber-300" />
        Bu ayarlarla en fazla {maxPaidCalls(template, quality)} ücretli Fal.ai çağrısı. Kütüphanedeki fotoğrafların kesimleri ve
        önbellekteki arka planlar bu sayıyı düşürür; gerçek sayı üretimden sonra gösterilir.
      </p>
    </fieldset>
  );
}
