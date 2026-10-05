import { Download } from "lucide-react";
import { RenderThumbnail } from "@/components/features/dashboard/render-thumbnail";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Eski kayıtlar SVG, yeniler PNG olabilir — indirme adı dosyanın gerçek uzantısını izler. */
function fileExtension(url: string): string {
  return /.([a-z0-9]+)$/i.exec(url)?.[1]?.toLowerCase() ?? "png";
}

interface DraftPreviewProps {
  url: string | null;
  width: number;
  height: number;
  downloadName: string;
  alt?: string;
}

/** Taslak görseli (oran korunarak) + indirme butonu — taslak inceleme ekranının önizlemesi. */
export function DraftPreview({ url, width, height, downloadName, alt = "Taslak görsel" }: DraftPreviewProps) {
  return (
    <div className="flex flex-col gap-3">
      <div
        className="mx-auto flex max-h-[640px] w-full items-center justify-center overflow-hidden rounded-lg bg-muted/30 ring-1 ring-border"
        style={{ aspectRatio: `${width} / ${height}` }}
      >
        <RenderThumbnail src={url} alt={alt} iconClassName="size-6" />
      </div>
      {url ? (
        <a href={url} download={`${downloadName}.${fileExtension(url)}`} className={cn(buttonVariants({ variant: "outline" }), "w-full")}>
          <Download />
          Görseli indir ({fileExtension(url).toUpperCase()})
        </a>
      ) : null}
    </div>
  );
}
