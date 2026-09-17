"use client";

import { useRef, useState } from "react";
import { ImageUp, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface PlayerUploadDropzoneProps {
  label: string;
  exampleHint: string;
}

export function PlayerUploadDropzone({
  label,
  exampleHint,
}: PlayerUploadDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  function handleFile(file: File | undefined) {
    if (!file || !file.type.startsWith("image/")) return;
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
    setFileName(file.name);
  }

  function clearFile(e: React.MouseEvent) {
    e.stopPropagation();
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setFileName(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">
        {label}
      </span>
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          handleFile(e.dataTransfer.files?.[0]);
        }}
        className={cn(
          "group relative flex aspect-square w-full cursor-pointer flex-col items-center justify-center overflow-hidden rounded-lg border border-dashed transition-colors",
          isDragging
            ? "border-emerald-400 bg-emerald-400/10"
            : "border-white/15 bg-white/[0.03] hover:border-white/30 hover:bg-white/[0.05]",
        )}
      >
        {previewUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt={fileName ?? "Yüklenen oyuncu fotoğrafı"}
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-x-0 bottom-0 truncate bg-black/70 px-2 py-1 text-[10px] text-white/90">
              {fileName}
            </div>
            <button
              type="button"
              onClick={clearFile}
              aria-label="Fotoğrafı kaldır"
              className="absolute right-1.5 top-1.5 rounded-full bg-black/70 p-1 text-white/80 transition-colors hover:bg-black/90 hover:text-white"
            >
              <X className="size-3.5" />
            </button>
          </>
        ) : (
          <div className="flex flex-col items-center gap-1.5 px-3 text-center">
            <ImageUp className="size-6 text-white/30 transition-colors group-hover:text-white/50" />
            <p className="text-[11px] leading-tight text-white/50">
              Sürükle bırak ya da tıkla
            </p>
            <p className="text-[10px] leading-tight text-white/30">
              örn. {exampleHint}
            </p>
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
      </div>
    </div>
  );
}
