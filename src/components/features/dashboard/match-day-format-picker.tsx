"use client";

import { MATCH_DAY_FRAMES } from "@/lib/dashboard/match-day-formats";
import { cn } from "@/lib/utils";
import { MATCH_DAY_FORMAT_IDS, type MatchDayFormatId } from "@/types/match-day";

interface MatchDayFormatPickerProps {
  value: MatchDayFormatId;
  onChange: (value: MatchDayFormatId) => void;
}

/** Platform/en-boy oranı seçimi — kutucuklar seçili oranı orantılı gösterir. Şablon ve AI çıktısı buna göre kurulur. */
export function MatchDayFormatPicker({ value, onChange }: MatchDayFormatPickerProps) {
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="mb-1 text-sm font-medium leading-none">Platform ve format</legend>
      <input type="hidden" name="format" value={value} />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {MATCH_DAY_FORMAT_IDS.map((id) => {
          const frame = MATCH_DAY_FRAMES[id];
          const box = 34;
          const scale = box / Math.max(frame.width, frame.height);
          return (
            <button
              key={id}
              type="button"
              onClick={() => onChange(id)}
              aria-pressed={value === id}
              className={cn(
                "flex flex-col items-center gap-1.5 rounded-lg border px-2 py-2.5 text-center transition-colors",
                value === id ? "border-emerald-500/60 bg-emerald-500/10" : "border-border hover:border-white/25 hover:bg-white/[0.03]",
              )}
            >
              <span className="flex h-9 items-center justify-center">
                <span
                  className={cn("rounded-[3px] border-2", value === id ? "border-emerald-400" : "border-white/40")}
                  style={{ width: frame.width * scale, height: frame.height * scale }}
                />
              </span>
              <span className="text-xs font-medium text-white">{frame.label}</span>
              <span className="text-[10px] text-muted-foreground">
                {frame.ratioLabel} · {frame.width}×{frame.height}
              </span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
