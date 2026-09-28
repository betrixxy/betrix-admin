"use client";

import { useEffect, useState, type ChangeEvent } from "react";
import { ImagePlus, X } from "lucide-react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface ImageUploadFieldProps {
  name: string;
  label: string;
  hint: string;
  className?: string;
}

/** Dosya seçildiğinde tarayıcıda anında küçük önizleme gösteren yükleme alanı. */
export function ImageUploadField({ name, label, hint, className }: ImageUploadFieldProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setFileName(file?.name ?? null);
    setPreviewUrl(file ? URL.createObjectURL(file) : null);
  }

  function clear(input: HTMLInputElement | null) {
    if (input) input.value = "";
    setPreviewUrl(null);
    setFileName(null);
  }

  const inputId = `upload-${name}`;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={inputId}>{label}</Label>
      <label
        htmlFor={inputId}
        className="group relative flex h-28 cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-dashed border-input bg-muted/20 transition-colors hover:border-emerald-500/50 hover:bg-emerald-500/[0.04]"
      >
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previewUrl} alt={`${label} önizlemesi`} className="size-full object-contain p-1" />
        ) : (
          <span className="flex flex-col items-center gap-1 text-muted-foreground">
            <ImagePlus className="size-5" />
            <span className="text-[11px]">Görsel seçmek için tıklayın</span>
          </span>
        )}
        <input
          id={inputId}
          name={name}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="sr-only"
          onChange={handleChange}
        />
      </label>
      <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
        <span className="truncate">{fileName ?? hint}</span>
        {previewUrl ? (
          <button
            type="button"
            className="flex items-center gap-0.5 hover:text-white"
            onClick={() => clear(document.getElementById(inputId) as HTMLInputElement | null)}
          >
            <X className="size-3" /> Kaldır
          </button>
        ) : null}
      </div>
    </div>
  );
}
