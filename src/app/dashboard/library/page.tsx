import type { Metadata } from "next";
import Link from "next/link";
import { ImageOff } from "lucide-react";
import { MediaDeleteButton } from "@/components/features/dashboard/media-delete-button";
import { MediaUploadForm } from "@/components/features/dashboard/media-upload-form";
import { PageHeader } from "@/components/features/dashboard/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MEDIA_CATEGORY_META, countMediaAssetsByCategory, listMediaAssets } from "@/lib/dashboard/media-library";
import { cn } from "@/lib/utils";
import { MEDIA_CATEGORIES, type MediaCategory } from "@/types/media";

export const metadata: Metadata = {
  title: "Medya Kütüphanesi — betrix.pro",
  description: "Kalıcı logo, oyuncu ve referans görsel kütüphanesi",
};

export const dynamic = "force-dynamic";

interface LibraryPageProps {
  searchParams: Promise<{ category?: string | string[] }>;
}

function parseCategory(param: string | string[] | undefined): MediaCategory {
  return MEDIA_CATEGORIES.find((category) => category === param) ?? "LOGO";
}

function formatBytes(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;
}

export default async function LibraryPage({ searchParams }: LibraryPageProps) {
  const category = parseCategory((await searchParams).category);
  const [assets, counts] = await Promise.all([listMediaAssets(category), countMediaAssetsByCategory()]);
  const meta = MEDIA_CATEGORY_META[category];

  return (
    <>
      <PageHeader
        title="Medya Kütüphanesi"
        description="Logoları, oyuncu fotoğraflarını ve referans görselleri bir kez ekleyin; stüdyoda her üretimde listeden seçin. Stüdyoda yeni yüklenen görseller de buraya otomatik kaydedilir."
      />

      <nav className="flex flex-wrap gap-2" aria-label="Klasörler">
        {MEDIA_CATEGORIES.map((item) => (
          <Link
            key={item}
            href={`/dashboard/library?category=${item}`}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm transition-colors",
              item === category ? "bg-white/[0.08] text-white" : "text-muted-foreground hover:text-white",
            )}
          >
            {MEDIA_CATEGORY_META[item].label} <span className="text-xs text-muted-foreground">{counts[item]}</span>
          </Link>
        ))}
      </nav>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>{meta.label}</CardTitle>
            <CardDescription>{meta.description}</CardDescription>
          </CardHeader>
          <CardContent>
            {assets.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                Bu klasör boş — sağdaki formdan ya da stüdyoda yükleyerek ekleyin.
              </p>
            ) : (
              <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {assets.map((asset) => (
                  <li key={asset.id} className="flex flex-col gap-1.5">
                    <div
                      className={cn(
                        "flex aspect-square items-center justify-center overflow-hidden rounded-lg ring-1 ring-border",
                        // Şeffaf logolar dama deseni üzerinde gösterilir — kenar/halo kontrolü için.
                        asset.hasAlpha
                          ? "bg-[repeating-conic-gradient(#27272a_0%_25%,#18181b_0%_50%)] bg-[length:16px_16px]"
                          : "bg-muted/30",
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
    </>
  );
}
