"use client";

import { useRef, useState, useTransition } from "react";
import { AlertCircle, ImagePlus, LoaderCircle, Trash2 } from "lucide-react";
import { generateAnalysisHeroAction } from "@/app/dashboard/studio/market-analysis/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import type { HeroQuality, MarketAnalysisDraft, TeamSide } from "@/types/deep-analysis";
import type { MediaAssetOption } from "@/types/media";
import { LibraryImageField } from "../library-image-field";

interface AnalysisHeroFieldsProps {
  draft: MarketAnalysisDraft;
  playerOptions: MediaAssetOption[];
  falConfigured: boolean;
  onHeroChange: (side: TeamSide, heroImageUrl: string) => void;
}

const SIDE_LABELS: Record<TeamSide, string> = { home: "Ev sahibi", away: "Deplasman" };
/** Renk seçilmemişse kapak sahnesi CheckMatch yeşiliyle üretilir (kartın parıltısıyla aynı). */
const BRAND_GREEN = "#22c24e";

interface SideStatus {
  pending: boolean;
  error: string | null;
  note: string | null;
}

/**
 * Kapak görseli: her takımın kilit oyuncusu (kütüphaneden ya da yeni yükleme) → Fal.ai kesim + sahne
 * → kalıcı kapak. Dosya alanları sekmelerin dışında tek bir formdadır: sekme değişince seçim kaybolmaz.
 * Kapak bir kez üretilir; önizleme ve kayıt onu kullanır (Fal.ai'ye tekrar gidilmez).
 */
export function AnalysisHeroFields({ draft, playerOptions, falConfigured, onHeroChange }: AnalysisHeroFieldsProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [quality, setQuality] = useState<HeroQuality>("PREMIUM");
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
    formData.set("colorHex", draft[side].colorHex || BRAND_GREEN);
    formData.set("quality", quality);
    update(side, { pending: true, error: null, note: null });
    startGenerating(async () => {
      const result = await generateAnalysisHeroAction(formData);
      if (!result.ok) {
        update(side, { pending: false, error: result.error.message });
        return;
      }
      onHeroChange(side, result.data.heroImageUrl);
      const steps = result.data.savedSteps.length ? ` · ${result.data.savedSteps.join(" · ")}` : "";
      update(side, { pending: false, note: `${result.data.paidCalls} ücretli Fal.ai çağrısı${steps}` });
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Kapak Görseli (Fal.ai)</CardTitle>
        <CardDescription>
          Her takımın kilit oyuncusunun fotoğrafını seçin ya da yükleyin (kısa kenar ≥ 1024px önerilir; küçükse AI ile büyütülür).
          Oyuncu kesilir (birefnet) ve takım renginde bir stadyum sahnesine yerleştirilir. Kapak bir kez üretilir; metin düzenlemeleri
          ücretsizdir. Takım rengini &quot;Takım Analizleri&quot; kartından seçin.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form ref={formRef} onSubmit={(event) => event.preventDefault()} className="flex flex-col gap-4">
          <div className="flex max-w-xs flex-col gap-1.5">
            <Label htmlFor="hero-quality">Sahne</Label>
            <NativeSelect id="hero-quality" value={quality} onChange={(event) => setQuality(event.target.value as HeroQuality)} className="h-8 text-xs">
              <option value="PREMIUM">Premium — Fal.ai stadyum sahnesi (takım rengi başına bir kez ücretli)</option>
              <option value="ECONOMY">Ekonomik — programatik sahne (ücretsiz)</option>
            </NativeSelect>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            {(["home", "away"] as const).map((side) => {
              const team = draft[side];
              const state = status[side];
              return (
                <div key={side} className="flex flex-col gap-2 rounded-lg border border-border/60 p-3">
                  <LibraryImageField
                    name={`${side}Hero`}
                    label={`${team.teamName || SIDE_LABELS[side]} · kilit oyuncu`}
                    hint="JPEG/PNG/WebP · yeni yükleme kütüphaneye kaydedilir"
                    options={playerOptions}
                  />
                  {team.heroImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- korumalı depolama dosyası, küçük önizleme.
                    <img src={team.heroImageUrl} alt={`${team.teamName} kapak görseli`} className="aspect-[1080/460] w-full rounded-md object-cover ring-1 ring-border" />
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
                      {state.pending ? <LoaderCircle className="animate-spin" /> : <ImagePlus />}
                      {state.pending ? "Kapak üretiliyor…" : team.heroImageUrl ? "Kapağı yeniden üret" : "Kapak üret"}
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
          </div>
          {!falConfigured ? <p className="text-xs text-muted-foreground">FAL_KEY tanımlı değil — kapak üretilemez; kart kapaksız çizilir.</p> : null}
        </form>
      </CardContent>
    </Card>
  );
}
