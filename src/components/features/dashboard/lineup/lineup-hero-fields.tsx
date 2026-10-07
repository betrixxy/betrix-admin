"use client";

import { useRef, useState, useTransition } from "react";
import { AlertCircle, LoaderCircle, Scissors, Trash2 } from "lucide-react";
import { generateLineupHeroAction } from "@/app/dashboard/studio/lineup/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { TeamSide } from "@/types/deep-analysis";
import type { LineupDraft } from "@/types/lineup";
import type { MediaAssetOption } from "@/types/media";
import { LibraryImageField } from "../library-image-field";

interface LineupHeroFieldsProps {
  draft: LineupDraft;
  playerOptions: MediaAssetOption[];
  falConfigured: boolean;
  onHeroChange: (side: TeamSide, heroImageUrl: string) => void;
}

const SIDE_LABELS: Record<TeamSide, string> = { home: "Ev sahibi", away: "Deplasman" };

interface SideStatus {
  pending: boolean;
  error: string | null;
  note: string | null;
}

/**
 * Kapak oyuncusu: her takım için kütüphaneden seçilen ya da yüklenen fotoğraf → Fal.ai kesimi
 * (birefnet, fotoğraf başına bir kez ücretli). Dosya alanları sekmelerin dışında tek bir formdadır:
 * sekme değişince seçim kaybolmaz. Kesim bir kez üretilir; önizleme ve kayıt onu kullanır.
 */
export function LineupHeroFields({ draft, playerOptions, falConfigured, onHeroChange }: LineupHeroFieldsProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [status, setStatus] = useState<Record<TeamSide, SideStatus>>({
    home: { pending: false, error: null, note: null },
    away: { pending: false, error: null, note: null },
  });
  const [, startGenerating] = useTransition();

  const update = (side: TeamSide, next: Partial<SideStatus>) => setStatus((current) => ({ ...current, [side]: { ...current[side], ...next } }));

  function generate(side: TeamSide) {
    if (!formRef.current) return;
    const formData = new FormData(formRef.current);
    formData.set("side", side);
    formData.set("teamName", draft[side].teamName);
    update(side, { pending: true, error: null, note: null });
    startGenerating(async () => {
      const result = await generateLineupHeroAction(formData);
      if (!result.ok) {
        update(side, { pending: false, error: result.error.message });
        return;
      }
      onHeroChange(side, result.data.heroImageUrl);
      update(side, { pending: false, note: result.data.paidCalls ? `${result.data.paidCalls} ücretli Fal.ai çağrısı` : "Kesim önbellekten (ücretsiz)" });
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Kapak Oyuncusu (Fal.ai)</CardTitle>
        <CardDescription>
          Her takım için öne çıkacak oyuncunun fotoğrafını seçin ya da yükleyin (kısa kenar ≥ 1024px önerilir; küçükse AI ile büyütülür).
          Arka planı birefnet ile temizlenir ve kartın sol yarısına yerleşir. Aynı fotoğraf ikinci kez ücret çıkarmaz. Kapak isteğe bağlıdır —
          yoksa kadro tüm genişliğe yayılır.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form ref={formRef} onSubmit={(event) => event.preventDefault()} className="grid gap-5 md:grid-cols-2">
          {(["home", "away"] as const).map((side) => {
            const team = draft[side];
            const state = status[side];
            return (
              <div key={side} className="flex flex-col gap-2 rounded-lg border border-border/60 p-3">
                <LibraryImageField
                  name={`${side}Hero`}
                  label={`${team.teamName || SIDE_LABELS[side]} · kapak oyuncusu`}
                  hint="JPEG/PNG/WebP"
                  options={playerOptions}
                />
                {team.heroImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- korumalı depolama dosyası, küçük önizleme.
                  <img
                    src={team.heroImageUrl}
                    alt={`${team.teamName} kapak oyuncusu kesimi`}
                    className="h-40 w-full rounded-md bg-[repeating-conic-gradient(#ffffff10_0_25%,transparent_0_50%)] bg-[length:16px_16px] object-contain ring-1 ring-border"
                  />
                ) : null}
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    className="flex-1"
                    disabled={!falConfigured || !team.teamName || state.pending}
                    onClick={() => generate(side)}
                    title={falConfigured ? undefined : "FAL_KEY tanımlı değil"}
                  >
                    {state.pending ? <LoaderCircle className="animate-spin" /> : <Scissors />}
                    {state.pending ? "Kesiliyor…" : team.heroImageUrl ? "Kesimi yenile" : "Kesimi üret"}
                  </Button>
                  {team.heroImageUrl ? (
                    <Button type="button" size="sm" variant="outline" onClick={() => onHeroChange(side, "")} title="Kartı kapaksız çiz">
                      <Trash2 />
                    </Button>
                  ) : null}
                </div>
                {state.note ? <p className="text-[11px] text-muted-foreground">{state.note}</p> : null}
                {state.error ? (
                  <p className="flex items-center gap-1.5 text-xs text-destructive" role="alert">
                    <AlertCircle className="size-3.5 shrink-0" />
                    {state.error}
                  </p>
                ) : null}
              </div>
            );
          })}
          {!falConfigured ? <p className="text-xs text-muted-foreground md:col-span-2">FAL_KEY tanımlı değil — kesim üretilemez; kart kapaksız çizilir.</p> : null}
        </form>
      </CardContent>
    </Card>
  );
}
