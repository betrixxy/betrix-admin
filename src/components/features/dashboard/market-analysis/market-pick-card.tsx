"use client";

import { Target } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { MarketSuggestion } from "@/types/deep-analysis";

interface MarketPickCardProps {
  /** Veriden türetilen öneriler — veri henüz yüklenmediyse null. */
  suggestions: MarketSuggestion[] | null;
  marketPick: string;
  marketRationale: string;
  onChange: (next: { marketPick?: string; marketRationale?: string }) => void;
}

/** "Olası Market Tahmini": veriden önerilen marketler (tıklanabilir) + elle tahmin ve gerekçe. */
export function MarketPickCard({ suggestions, marketPick, marketRationale, onChange }: MarketPickCardProps) {
  return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="size-4 text-amber-400" />
            Olası Market Tahmini
          </CardTitle>
          <CardDescription>Veriden türetilen öneriler başlangıç noktasıdır; son karar sizin.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {suggestions && suggestions.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion.pick}
                  type="button"
                  onClick={() => onChange({ marketPick: suggestion.pick, marketRationale: suggestion.reason })}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs transition-colors",
                    marketPick === suggestion.pick ? "border-amber-400/60 bg-amber-400/15 text-amber-200" : "border-border text-muted-foreground hover:text-foreground",
                  )}
                  title={suggestion.reason}
                >
                  {suggestion.pick}
                </button>
              ))}
            </div>
          ) : suggestions ? (
            <p className="text-xs text-muted-foreground">Veri belirgin bir market sinyali vermiyor — tahmini elle girin.</p>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-[1fr_2fr]">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="market-pick">Tahmin</Label>
              <Input
                id="market-pick"
                value={marketPick}
                maxLength={40}
                placeholder="Ör. 2.5 Üst, KG Var"
                onChange={(event) => onChange({ marketPick: event.target.value })}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="market-rationale">Gerekçe</Label>
              <Input
                id="market-rationale"
                value={marketRationale}
                maxLength={160}
                placeholder="Ör. Beklenen toplam gol 3.1"
                onChange={(event) => onChange({ marketRationale: event.target.value })}
              />
            </div>
          </div>
        </CardContent>
      </Card>
  );
}
