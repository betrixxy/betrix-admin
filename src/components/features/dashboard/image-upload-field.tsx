"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { AlertCircle, ImagePlus, LoaderCircle, X } from "lucide-react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { prepareUploadFile } from "./prepare-upload";

interface ImageUploadFieldProps {
  name: string;
  label: string;
  hint: string;
  className?: string;
}

/**
 * Dosya seçildiğinde tarayıcıda anında küçük önizleme gösteren yükleme alanı. Seçilen dosya önce
 * hazırlanır (`prepare-upload.ts`): bozuk dosya reddedilir; sunucunun kabul etmeyeceği kadar büyük
 * fotoğraf (8 MB / 6000 px üstü) küçültülüp girişteki dosyanın yerine konur — sığan dosya olduğu gibi gider.
 */
export function ImageUploadField({ name, label, hint, className }: ImageUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function clear() {
    if (inputRef.current) inputRef.current.value = "";
    setPreviewUrl(null);
    setFileName(null);
    setNote(null);
  }

  async function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    setError(null);
    setNote(null);
    if (!file) {
      clear();
      return;
    }
    setPreparing(true);
    const prepared = await prepareUploadFile(file);
    setPreparing(false);
    if (!prepared.ok) {
      clear();
      setError(prepared.message);
      return;
    }
    if (prepared.file !== file) {
      // Küçültülen dosya formla gönderilen dosya olur (aynı alan adı).
      const transfer = new DataTransfer();
      transfer.items.add(prepared.file);
      input.files = transfer.files;
    }
    setFileName(prepared.file.name);
    setNote(prepared.note);
    setPreviewUrl(URL.createObjectURL(prepared.file));
  }

  const inputId = `upload-${name}`;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label ? <Label htmlFor={inputId}>{label}</Label> : null}
      <label
        htmlFor={inputId}
        className="group relative flex h-28 cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-dashed border-input bg-muted/20 transition-colors hover:border-emerald-500/50 hover:bg-emerald-500/[0.04]"
      >
        {preparing ? (
          <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <LoaderCircle className="size-4 animate-spin" /> Fotoğraf hazırlanıyor…
          </span>
        ) : previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previewUrl} alt={`${label || "Görsel"} önizlemesi`} className="size-full object-contain p-1" />
        ) : (
          <span className="flex flex-col items-center gap-1 text-muted-foreground">
            <ImagePlus className="size-5" />
            <span className="text-[11px]">Görsel seçmek için tıklayın</span>
          </span>
        )}
        <input ref={inputRef} id={inputId} name={name} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={handleChange} />
      </label>
      <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
        <span className="truncate">{fileName ?? hint}</span>
        {previewUrl ? (
          <button type="button" className="flex items-center gap-0.5 hover:text-white" onClick={clear}>
            <X className="size-3" /> Kaldır
          </button>
        ) : null}
      </div>
      {note ? <p className="text-[11px] text-emerald-300/90">{note}</p> : null}
      {error ? (
        <p className="flex items-center gap-1.5 text-[11px] text-destructive" role="alert">
          <AlertCircle className="size-3.5 shrink-0" />
          {error}
        </p>
      ) : null}
    </div>
  );
}
