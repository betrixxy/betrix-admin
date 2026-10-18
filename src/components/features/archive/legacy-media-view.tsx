import { ImageOff } from "lucide-react";
import { MediaDeleteButton } from "@/components/features/dashboard/media-delete-button";
import { MediaUploadForm } from "@/components/features/dashboard/media-upload-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MEDIA_CATEGORY_META, listMediaAssets } from "@/lib/dashboard/media-library";
import { cn } from "@/lib/utils";

function formatBytes(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;
}

/**
 * Logolar ve Referanslar — eski düz kütüphane görünümü (fotoğraflar artık arşivde). LOGO'da turnuva
 * logosu `league-<id>` etiketiyle set rozetine gider.
 */
export async function LegacyMediaView({ category }: { category: "LOGO" | "REFERENCE" }) {
  const assets = await listMediaAssets(category);
  const meta = MEDIA_CATEGORY_META[category];
  return (
    <div className="grid gap-6 xl:grid-cols-3">
      <Card className="xl:col-span-2">
        <CardHeader>
          <CardTitle>{meta.label}</CardTitle>
          <CardDescription>{meta.description}</CardDescription>
        </CardHeader>
        <CardContent>
          {assets.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Bu klasör boş — sağdaki formdan ekleyin.</p>
          ) : (
            <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {assets.map((asset) => (
                <li key={asset.id} className="flex flex-col gap-1.5">
                  <div
                    className={cn(
                      "flex aspect-square items-center justify-center overflow-hidden rounded-lg ring-1 ring-border",
                      // Şeffaf logolar dama deseni üzerinde gösterilir — kenar/halo kontrolü için.
                      asset.hasAlpha ? "bg-[repeating-conic-gradient(#27272a_0%_25%,#18181b_0%_50%)] bg-[length:16px_16px]" : "bg-muted/30",
                    )}
                  >
                    {asset.fileUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={asset.fileUrl} alt={asset.label} loading="lazy" className="size-full object-contain p-2" />
                    ) : (
                      <ImageOff className="size-5 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex items-start justify-between gap-1">
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate text-xs text-white" title={asset.label}>
                        {asset.label}
                      </span>
                      <span className="truncate text-[10px] text-muted-foreground">
                        {asset.teamName ? `${asset.teamName} · ` : ""}
                        {asset.width}×{asset.height} · {formatBytes(asset.sizeBytes)}
                      </span>
                    </div>
                    <MediaDeleteButton id={asset.id} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
      <MediaUploadForm key={category} defaultCategory={category} />
    </div>
  );
}
