"use client";

import { useState } from "react";
import { ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";

interface RenderThumbnailProps {
  src: string | null;
  alt: string;
  iconClassName?: string;
}

/**
 * Üretilen görselin küçük önizlemesi. Dosya yoksa, silinmişse veya sunucu hata döndürürse
 * (ör. `/api/files` 404/500) tarayıcının kırık görsel ikonu yerine sade bir yer tutucu gösterir.
 */
export function RenderThumbnail({ src, alt, iconClassName }: RenderThumbnailProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  if (!src || failedSrc === src) {
    return (
      <span className="flex flex-col items-center gap-1 text-muted-foreground" title="Önizleme yüklenemedi">
        <ImageOff className={cn("size-4", iconClassName)} />
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} loading="lazy" className="size-full object-contain" onError={() => setFailedSrc(src)} />
  );
}
