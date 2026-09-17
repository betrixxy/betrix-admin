"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const OUTCOME_OPTIONS = [
  { value: "HOME", label: "Ev Sahibi Kazanır (1)" },
  { value: "DRAW", label: "Beraberlik (X)" },
  { value: "AWAY", label: "Deplasman Kazanır (2)" },
] as const;

export function AiPredictionForm() {
  const [confidence, setConfidence] = useState([72]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <span className="text-xs font-medium text-muted-foreground">
          İddaa Oranları
        </span>
        <div className="grid grid-cols-3 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="odds-home">1</Label>
            <Input id="odds-home" type="number" step="0.01" placeholder="2.10" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="odds-draw">X</Label>
            <Input id="odds-draw" type="number" step="0.01" placeholder="3.40" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="odds-away">2</Label>
            <Input id="odds-away" type="number" step="0.01" placeholder="3.20" />
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="predicted-outcome">Tahmin Edilen Sonuç</Label>
        <Select defaultValue="HOME">
          <SelectTrigger id="predicted-outcome" className="w-full">
            <SelectValue placeholder="Sonuç seç" />
          </SelectTrigger>
          <SelectContent>
            {OUTCOME_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <Label htmlFor="ai-confidence">AI Güven Skoru</Label>
          <span className="font-mono text-sm font-semibold text-emerald-400">
            %{confidence[0]}
          </span>
        </div>
        <Slider
          id="ai-confidence"
          value={confidence}
          onValueChange={(next) =>
            setConfidence(Array.isArray(next) ? [...next] : [next])
          }
          min={0}
          max={100}
          step={1}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ai-commentary">Kısa AI Yorumu</Label>
        <Textarea
          id="ai-commentary"
          placeholder="örn. Ev sahibi son 5 maçta 4 galibiyet aldı, deplasmanın orta saha eksikliği maçın kaderini belirleyebilir."
          className="min-h-24 resize-none"
        />
      </div>
    </div>
  );
}
