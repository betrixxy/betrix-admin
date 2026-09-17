"use client";

import { cn } from "@/lib/utils";
import { hexToRgba } from "@/lib/studio/color";
import { TOURNAMENTS } from "@/lib/studio/tournaments";
import type { TournamentId } from "@/types/studio";

interface TournamentSelectorProps {
  value: TournamentId;
  onChange: (id: TournamentId) => void;
}

export function TournamentSelector({
  value,
  onChange,
}: TournamentSelectorProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Turnuva / Lig"
      className="flex flex-wrap gap-2"
    >
      {TOURNAMENTS.map((tournament) => {
        const isActive = tournament.id === value;
        return (
          <button
            key={tournament.id}
            type="button"
            role="radio"
            aria-checked={isActive}
            onClick={() => onChange(tournament.id)}
            style={
              isActive
                ? {
                    borderColor: hexToRgba(tournament.primary, 0.6),
                    backgroundColor: hexToRgba(tournament.primary, 0.14),
                    boxShadow: `0 0 0 1px ${hexToRgba(tournament.primary, 0.25)}, 0 8px 20px -8px ${hexToRgba(tournament.primary, 0.5)}`,
                  }
                : undefined
            }
            className={cn(
              "flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
              isActive
                ? "text-white"
                : "border-border text-muted-foreground hover:border-white/25 hover:text-white/80",
            )}
          >
            <span
              className="size-2 rounded-full"
              style={{ backgroundColor: tournament.primary }}
              aria-hidden
            />
            {tournament.shortLabel}
          </button>
        );
      })}
    </div>
  );
}
