"use client";

import { useActionState, useState, useTransition, type FormEvent } from "react";
import { AlertCircle, CheckCircle2, ImagePlus, LoaderCircle, Save } from "lucide-react";
import { regenerateBackgroundAction, updateDraftAction } from "@/app/dashboard/drafts/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import type { DraftActionState, DraftRenderOptions } from "@/types/draft";
import type { DerbyIntensity } from "@/types/sports";
import { StatSelectionFields } from "./stat-selection-fields";

const INITIAL_STATE: DraftActionState = {};

const DERBY_OPTIONS: { value: DerbyIntensity; label: string }[] = [
  { value: "NONE", label: "Standart maç — sakin, dengeli ışık" },
  { value: "RIVALRY", label: "Rekabet — gergin, keskin kontrast" },
  { value: "DERBY", label: "Derbi — neon, elektrikli atmosfer" },
  { value: "ELITE_DERBY", label: "Büyük maç — sinematik, dramatik" },
];

type Intent = "save" | "regenerate";

interface DraftReviewFormProps {
  id: string;
  caption: string;
  renderOptions: DraftRenderOptions;
  falConfigured: boolean;
}

/**
 * Taslak düzenleme: metin + istatistik seçimi + derbi tansiyonu. İki yol:
 * "Kaydet" görseli depodaki katmanlardan yeniden çizer (ücretsiz); "Arka planı yeniden üret"
 * Fal.ai'ye gider (ücretli). Formu tek tutmak, iki yolda da admin'in düzenlemelerini korur.
 */
export function DraftReviewForm({ id, caption, renderOptions, falConfigured }: DraftReviewFormProps) {
  const [saveState, saveAction, isSaving] = useActionState(updateDraftAction, INITIAL_STATE);
  const [regenState, regenAction, isRegenerating] = useActionState(regenerateBackgroundAction, INITIAL_STATE);
  const [lastIntent, setLastIntent] = useState<Intent>("save");
  const [, startTransition] = useTransition();
  const isPending = isSaving || isRegenerating;
  const state = lastIntent === "save" ? saveState : regenState;

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const intent: Intent = submitter?.getAttribute("value") === "regenerate" ? "regenerate" : "save";
    const formData = new FormData(event.currentTarget);
    setLastIntent(intent);
    startTransition(() => (intent === "regenerate" ? regenAction(formData) : saveAction(formData)));
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Düzenle</CardTitle>
        <CardDescription>Metni ve görselde gösterilecek verileri ayarlayın; değişiklikler önizlemeye yansır.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <input type="hidden" name="id" value={id} />

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="caption">Gönderi metni</Label>
            <Textarea id="caption" name="caption" rows={12} maxLength={2200} defaultValue={caption} className="font-mono text-xs leading-relaxed" />
            <span className="text-[11px] text-muted-foreground">
              Gerçek istatistiklerden şablonla üretildi — dili ve tonu buradan oturtun.
            </span>
          </div>

          <StatSelectionFields defaults={renderOptions.selection} disabled={isPending} />

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="derbyIntensity">Maç tansiyonu (arka plan atmosferi)</Label>
            <NativeSelect id="derbyIntensity" name="derbyIntensity" defaultValue={renderOptions.derbyIntensity}>
              {DERBY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </NativeSelect>
            <span className="text-[11px] text-muted-foreground">Yalnızca arka plan yeniden üretildiğinde etkili olur.</span>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="customPrompt">Arka plan için ek yönerge (isteğe bağlı)</Label>
            <Textarea id="customPrompt" name="customPrompt" rows={2} maxLength={1000} placeholder="Örn: yağmurlu gece, kırmızı neon…" />
          </div>

          {state.error ? (
            <p className="flex items-center gap-1.5 text-xs text-destructive" role="alert">
              <AlertCircle className="size-3.5 shrink-0" />
              {state.error}
            </p>
          ) : state.notice ? (
            <p className="flex items-center gap-1.5 text-xs text-emerald-400" role="status">
              <CheckCircle2 className="size-3.5 shrink-0" />
              {state.notice}
            </p>
          ) : null}

          <div className="grid gap-2 sm:grid-cols-2">
            <Button type="submit" name="intent" value="save" disabled={isPending}>
              {isSaving ? <LoaderCircle className="animate-spin" /> : <Save />}
              Kaydet ve yeniden çiz
            </Button>
            <Button type="submit" name="intent" value="regenerate" variant="outline" disabled={isPending || !falConfigured}>
              {isRegenerating ? <LoaderCircle className="animate-spin" /> : <ImagePlus />}
              Arka planı yeniden üret
            </Button>
          </div>
          <span className="text-[10px] text-muted-foreground/80">
            &quot;Kaydet&quot; ücretsizdir (mevcut arka plan kullanılır). &quot;Arka planı yeniden üret&quot; Fal.ai&apos;ye yeni bir istek gönderir (ücretli).
          </span>
        </form>
      </CardContent>
    </Card>
  );
}
