"use client";

import { AlertCircle, CheckCircle2, LoaderCircle, Upload } from "lucide-react";
import { uploadMediaAction } from "@/app/dashboard/library/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { useActionForm } from "@/hooks/use-action-form";
import { MEDIA_CATEGORY_META } from "@/lib/dashboard/media-library-meta";
import { MEDIA_CATEGORIES, type MediaActionState, type MediaCategory } from "@/types/media";
import { ImageUploadField } from "./image-upload-field";

const INITIAL_STATE: MediaActionState = {};

export function MediaUploadForm({ defaultCategory }: { defaultCategory: MediaCategory }) {
  const { state, isPending, onSubmit } = useActionForm(uploadMediaAction, INITIAL_STATE);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Görsel Ekle</CardTitle>
        <CardDescription>Bir kez ekleyin, stüdyoda her üretimde listeden seçin.</CardDescription>
      </CardHeader>
      <CardContent>
        {/* Başarılı eklemede (yeni bildirim metni) form yeniden kurulur — alanlar ve önizleme sıfırlanır. */}
        <form key={state.notice ?? "media-upload"} onSubmit={onSubmit} className="flex flex-col gap-3.5">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="category">Klasör</Label>
            <NativeSelect id="category" name="category" defaultValue={defaultCategory}>
              {MEDIA_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {MEDIA_CATEGORY_META[category].label}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="label">Ad</Label>
            <Input id="label" name="label" required maxLength={120} placeholder="Örn: Galatasaray logo — beyaz" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="teamName">Takım (isteğe bağlı)</Label>
              <Input id="teamName" name="teamName" maxLength={120} placeholder="Galatasaray" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="teamId">API-Football takım ID</Label>
              <Input id="teamId" name="teamId" inputMode="numeric" pattern="\d*" placeholder="645" />
            </div>
          </div>
          <ImageUploadField name="file" label="Görsel" hint="JPEG/PNG/WebP · en fazla 8 MB · oyuncular için ≥1024px" />

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

          <Button type="submit" disabled={isPending}>
            {isPending ? <LoaderCircle className="animate-spin" /> : <Upload />}
            Kütüphaneye ekle
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
