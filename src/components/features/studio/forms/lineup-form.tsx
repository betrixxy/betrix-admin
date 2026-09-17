"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FORMATIONS, FORMATION_POSITIONS } from "@/lib/studio/formations";
import type { FormationId, MatchSide } from "@/types/studio";

export function LineupForm() {
  const [side, setSide] = useState<MatchSide>("home");
  const [formation, setFormation] = useState<FormationId>("4-3-3");
  const positions = FORMATION_POSITIONS[formation];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-muted-foreground">
          Kadrosu Gösterilecek Takım
        </span>
        <div className="grid grid-cols-2 gap-1 rounded-lg border border-border bg-white/[0.02] p-1">
          {(["home", "away"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setSide(option)}
              className={cn(
                "rounded-md py-1.5 text-sm font-medium transition-colors",
                side === option
                  ? "bg-white/10 text-white"
                  : "text-muted-foreground hover:text-white/70",
              )}
            >
              {option === "home" ? "Ev Sahibi" : "Deplasman"}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="formation">Formasyon</Label>
        <Select
          value={formation}
          onValueChange={(v) => setFormation(v as FormationId)}
        >
          <SelectTrigger id="formation" className="w-full">
            <SelectValue placeholder="Formasyon seç" />
          </SelectTrigger>
          <SelectContent>
            {FORMATIONS.map((f) => (
              <SelectItem key={f} value={f}>
                {f}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-xs font-medium text-muted-foreground">
          {side === "home" ? "Ev Sahibi" : "Deplasman"} Muhtemel 11 — {formation}
        </span>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {positions.map((position, index) => (
            <div key={`${position}-${index}`} className="flex flex-col gap-1">
              <Label
                htmlFor={`lineup-${side}-${formation}-${index}`}
                className="text-[11px] font-normal text-white/50"
              >
                {index + 1}. {position}
              </Label>
              <Input
                id={`lineup-${side}-${formation}-${index}`}
                placeholder="Oyuncu adı"
                className="h-8 text-xs"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
