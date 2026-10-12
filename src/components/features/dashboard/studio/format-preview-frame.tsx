import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { SOCIAL_FORMATS, type SocialFormatId } from "@/types/studio-formats";

/**
 * Önizleme çerçevesi: seçilen formatın oranında kutu (dikey formatlarda yükseklik sınırlı, kart
 * sayfadan taşmaz). Tüm stüdyo önizlemeleri aynı çerçeveyi kullanır.
 */
export function FormatPreviewFrame({ format, busy, children }: { format: SocialFormatId; busy: boolean; children: ReactNode }) {
  const { width, height } = SOCIAL_FORMATS[format];
  return (
    <div
      className={cn("relative mx-auto flex max-h-[72vh] w-full items-center justify-center overflow-hidden rounded-lg border border-border/60 bg-black/30", busy && "opacity-60")}
      style={{ aspectRatio: `${width} / ${height}`, maxWidth: `calc(72vh * ${width / height})` }}
    >
      {children}
    </div>
  );
}
