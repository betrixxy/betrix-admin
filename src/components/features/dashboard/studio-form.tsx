"use client";

import { useState } from "react";
import { AlertCircle, Sparkles } from "lucide-react";
import { generateAiContentAction } from "@/app/dashboard/studio/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { useActionForm } from "@/hooks/use-action-form";
import { STUDIO_FORMAT_DEFS } from "@/lib/dashboard/studio-formats";
import { STUDIO_FORMATS, type StudioActionState, type StudioFormat, type StudioPostOption } from "@/types/ai-content";
import type { FixtureOption } from "@/types/social";
import { ImageUploadField } from "./image-upload-field";
import { StudioPreview } from "./studio-preview";

interface StudioFormProps {
  fixtures: FixtureOption[];
  postOptions: StudioPostOption[];
  /** FAL_KEY tanımlı değilken formu kilitler — bkz. dashboard/studio/page.tsx uyarı bandı. */
  disabled?: boolean;
}

const INITIAL_STATE: StudioActionState = {};

export function StudioForm({ fixtures, postOptions, disabled = false }: StudioFormProps) {
  const { state, isPending, onSubmit } = useActionForm(generateAiContentAction, INITIAL_STATE);
  const [format, setFormat] = useState<StudioFormat>("IG_FEED");
  const isDisabled = disabled || isPending;

  return (
    <div className="grid gap-6 xl:grid-cols-5">
      <Card className="xl:col-span-3">
        <CardHeader>
          <CardTitle>Yeni Görsel Üret</CardTitle>
          <CardDescription>
            Maçı ve formatı seçin, görsellerinizi yükleyin; maç istatistikleriyle birleştirilerek nihai görsel üretilir.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="fixtureId">Maç</Label>
                <NativeSelect id="fixtureId" name="fixtureId" required defaultValue="">
                  <option value="" disabled>
                    Maç seçin…
                  </option>
                  {fixtures.map((fixture) => (
                    <option key={fixture.id} value={fixture.id}>
                      {fixture.label}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="format">Format</Label>
                <NativeSelect
                  id="format"
                  name="format"
                  value={format}
                  onChange={(event) => setFormat(event.target.value as StudioFormat)}
                >
                  {STUDIO_FORMATS.map((id) => (
                    <option key={id} value={id}>
                      {STUDIO_FORMAT_DEFS[id].label} ({STUDIO_FORMAT_DEFS[id].ratioLabel})
                    </option>
                  ))}
                </NativeSelect>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <ImageUploadField
                name="playerPhoto"
                label="Oyuncu fotoğrafı"
                hint="JPEG/PNG/WebP · en az 1024px kısa kenar"
              />
              <ImageUploadField name="logo" label="Özel logo" hint="JPEG/PNG/WebP · isteğe bağlı" />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="customPrompt">Özel prompt</Label>
              <Textarea
                id="customPrompt"
                name="customPrompt"
                rows={3}
                maxLength={1000}
                placeholder="Örn: yağmurlu gece atmosferi, kırmızı-siyah neon ışıklar…"
              />
              <span className="text-[11px] text-muted-foreground">
                Sistemin oluşturduğu stadyum prompt&apos;una ek yönerge olarak eklenir.
              </span>
            </div>

            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 text-sm font-medium">Görsele eklenecek maç istatistikleri</legend>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="includeForm" defaultChecked className="size-4 accent-emerald-500" />
                Son 5 maç formu
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="includeXg" defaultChecked className="size-4 accent-emerald-500" />
                xG / xGA (maç başı)
              </label>
            </fieldset>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="postId">Gönderiye bağla (isteğe bağlı)</Label>
              <NativeSelect id="postId" name="postId" defaultValue="">
                <option value="">Bağlama — sonra karar veririm</option>
                {postOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </NativeSelect>
            </div>

            {state.error ? (
              <p className="flex items-center gap-1.5 text-xs text-destructive" role="alert">
                <AlertCircle className="size-3.5 shrink-0" />
                {state.error}
              </p>
            ) : null}

            <Button type="submit" size="lg" disabled={isDisabled}>
              <Sparkles />
              {isPending ? "Üretiliyor…" : "Görseli Üret"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="xl:col-span-2">
        <StudioPreview format={format} result={state.result} isPending={isPending} />
      </div>
    </div>
  );
}
