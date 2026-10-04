"use client";

import { Shuffle } from "lucide-react";
import { MATCH_DAY_TEMPLATES, RANDOM_TEMPLATE } from "@/lib/dashboard/match-day-templates";
import { cn } from "@/lib/utils";
import { MATCH_DAY_TEMPLATE_IDS, type MatchDayTemplateId } from "@/types/match-day";

/** Şablonların küçük şematik önizlemesi (oyuncu bölgeleri + metin blokları) — gerçek render değil. */
function Thumb({ id }: { id: MatchDayTemplateId }) {
  const player = "absolute rounded-t-full bg-white/30";
  return (
    <div className="relative aspect-[4/5] w-14 shrink-0 overflow-hidden rounded-md ring-1 ring-white/10">
      {id === "PREMIUM_BROADCAST" ? (
        <div className="absolute inset-0 bg-gradient-to-b from-slate-700 via-slate-800 to-slate-950">
          <span className="absolute left-1/2 top-1 size-2 -translate-x-1/2 rounded-sm bg-white/80" />
          <span className={cn(player, "left-2 top-4 h-9 w-6")} />
          <span className={cn(player, "right-2 top-4 h-9 w-6")} />
          <span className="absolute inset-x-1.5 top-[42px] h-2.5 rounded-sm bg-white/90" />
          <span className="absolute left-1/2 top-[50px] h-0.5 w-3 -translate-x-1/2 bg-amber-300" />
          <span className="absolute inset-x-3 bottom-2 h-1 rounded-sm bg-white/40" />
        </div>
      ) : id === "DATA_DRIVEN" ? (
        <div className="absolute inset-0 bg-zinc-950">
          <span className="absolute left-1 top-1.5 h-1 w-5 rounded-sm bg-amber-400" />
          <span className="absolute left-1 top-4 h-1.5 w-6 rounded-sm bg-white/80" />
          <span className="absolute left-1 top-7 h-3 w-3 rounded-sm bg-amber-400" />
          <span className={cn(player, "right-0.5 top-4 h-10 w-5")} />
          <span className="absolute bottom-1.5 left-1 flex gap-0.5">
            {[0, 1, 2, 3].map((index) => (
              <span key={index} className="h-2.5 w-2.5 rounded-[2px] border border-amber-400" />
            ))}
          </span>
        </div>
      ) : (
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,#52525b,#09090b_70%)]">
          <span className="absolute inset-x-2 top-1.5 h-px bg-white/60" />
          <span className={cn(player, "left-3 top-3 h-11 w-5 bg-white/40")} />
          <span className={cn(player, "right-3 top-3 h-11 w-5 bg-white/40")} />
          <span className="absolute left-1 top-[44px] font-serif text-[9px] leading-none text-white">Ab</span>
          <span className="absolute right-1 top-[54px] font-serif text-[9px] leading-none text-white">Cd</span>
        </div>
      )}
    </div>
  );
}

const OPTIONS = [
  { id: RANDOM_TEMPLATE, label: "Rastgele", description: "Sistem her üretimde şablonlardan birini seçer." },
  ...MATCH_DAY_TEMPLATE_IDS.map((id) => ({ id, label: MATCH_DAY_TEMPLATES[id].label, description: MATCH_DAY_TEMPLATES[id].description })),
];

interface MatchDayTemplatePickerProps {
  value: string;
  onChange: (value: string) => void;
}

/** Tasarım şablonu seçimi — `template` alanını gönderir; "Rastgele"yi sunucu çözer. */
export function MatchDayTemplatePicker({ value, onChange }: MatchDayTemplatePickerProps) {
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="mb-1 text-sm font-medium leading-none">Tasarım şablonu</legend>
      <input type="hidden" name="template" value={value} />
      <div className="grid gap-2 sm:grid-cols-2">
        {OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange(option.id)}
            aria-pressed={value === option.id}
            className={cn(
              "flex items-center gap-3 rounded-lg border p-2 text-left transition-colors",
              value === option.id ? "border-emerald-500/60 bg-emerald-500/10" : "border-border hover:border-white/25 hover:bg-white/[0.03]",
            )}
          >
            {option.id === RANDOM_TEMPLATE ? (
              <span className="flex aspect-[4/5] w-14 shrink-0 items-center justify-center rounded-md bg-muted/40 ring-1 ring-white/10">
                <Shuffle className="size-5 text-muted-foreground" />
              </span>
            ) : (
              <Thumb id={option.id as MatchDayTemplateId} />
            )}
            <span className="flex flex-col gap-0.5">
              <span className="text-sm font-medium text-white">{option.label}</span>
              <span className="text-[11px] leading-snug text-muted-foreground">{option.description}</span>
            </span>
          </button>
        ))}
      </div>
    </fieldset>
  );
}
