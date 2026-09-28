"use client";

import { useState, useTransition } from "react";
import { AlertCircle, Check, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AD_PLATFORM_META, AD_PLATFORM_ORDER } from "@/lib/calendar/ad-platform";
import { formatAdSpend } from "@/lib/calendar/ad-spend";
import type { AdPlatform, AdSpend } from "@/types/calendar";
import type { Result } from "@/types/result";

interface AdSpendFormProps {
  adSpend: AdSpend;
  onSave: (adSpend: AdSpend) => Promise<Result<null>>;
}

type Draft = Record<AdPlatform, string>;

function toDraft(adSpend: AdSpend): Draft {
  return {
    meta: adSpend.meta ? String(adSpend.meta) : "",
    tiktok: adSpend.tiktok ? String(adSpend.tiktok) : "",
    youtube: adSpend.youtube ? String(adSpend.youtube) : "",
    x: adSpend.x ? String(adSpend.x) : "",
  };
}

/** Maç başına reklam bütçesi — `ContentPlan` tablosuna kalıcı yazılır (bkz. app/calendar/actions.ts). */
export function AdSpendForm({ adSpend, onSave }: AdSpendFormProps) {
  const [draft, setDraft] = useState<Draft>(() => toDraft(adSpend));
  const [justSaved, setJustSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, startSaving] = useTransition();

  const total = AD_PLATFORM_ORDER.reduce(
    (sum, platform) => sum + (Number(draft[platform]) || 0),
    0,
  );

  function handleChange(platform: AdPlatform, value: string) {
    setJustSaved(false);
    setError(null);
    setDraft((current) => ({ ...current, [platform]: value }));
  }

  function handleSave() {
    const next: AdSpend = { currency: "TRY" };
    for (const platform of AD_PLATFORM_ORDER) {
      const amount = Number(draft[platform]);
      if (amount > 0) next[platform] = amount;
    }
    startSaving(async () => {
      const result = await onSave(next);
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 2000);
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2.5">
        {AD_PLATFORM_ORDER.map((platform) => {
          const meta = AD_PLATFORM_META[platform];
          return (
            <div key={platform} className="flex flex-col gap-1">
              <Label
                htmlFor={`spend-${platform}`}
                className="gap-1.5 text-xs font-normal text-muted-foreground"
              >
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={{ backgroundColor: meta.colorHex }}
                  aria-hidden
                />
                {meta.label}
              </Label>
              <div className="relative">
                <Input
                  id={`spend-${platform}`}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={50}
                  placeholder="0"
                  value={draft[platform]}
                  onChange={(event) => handleChange(platform, event.target.value)}
                  className="h-8 pr-6 text-sm"
                />
                <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                  ₺
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between border-t border-border/60 pt-3">
        <span className="text-sm text-muted-foreground">
          Toplam <span className="font-semibold text-foreground">{formatAdSpend(total)}</span>
        </span>
        <Button size="sm" onClick={handleSave} disabled={isSaving} className="gap-1.5">
          {isSaving ? <LoaderCircle className="size-3.5 animate-spin" /> : justSaved ? <Check className="size-3.5" /> : null}
          {justSaved ? "Kaydedildi" : "Kaydet"}
        </Button>
      </div>
      {error ? (
        <p className="flex items-center gap-1.5 text-xs text-destructive" role="alert">
          <AlertCircle className="size-3.5 shrink-0" />
          {error}
        </p>
      ) : null}
    </div>
  );
}
