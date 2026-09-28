import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { ImageOff } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { AiContentView } from "@/types/ai-content";
import { AiContentDeleteButton } from "./ai-content-delete-button";

interface AiContentGalleryProps {
  items: AiContentView[];
  totalCount: number;
  fixtureLabels: Record<string, string>;
}

export function AiContentGallery({ items, totalCount, fixtureLabels }: AiContentGalleryProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Üretim Geçmişi</CardTitle>
        <CardDescription>
          Toplam {totalCount} görsel · son {items.length} tanesi gösteriliyor
        </CardDescription>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Henüz üretilmiş görsel yok.</p>
        ) : (
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6">
            {items.map((item) => (
              <li key={item.id} className="flex flex-col gap-2">
                <div className="flex aspect-[4/5] items-center justify-center overflow-hidden rounded-lg bg-muted/30 ring-1 ring-border">
                  {item.resultImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.resultImageUrl} alt="Üretilen görsel" loading="lazy" className="size-full object-contain" />
                  ) : (
                    <ImageOff className="size-5 text-muted-foreground" />
                  )}
                </div>
                <div className="flex items-start justify-between gap-1">
                  <div className="flex min-w-0 flex-col">
                    <span className="text-[11px] text-white">
                      {format(new Date(item.createdAt), "d MMM, HH:mm", { locale: tr })}
                    </span>
                    <span className="truncate text-[10px] text-muted-foreground" title={item.prompt}>
                      {fixtureLabels[item.fixtureId] ?? item.fixtureId}
                      {item.postId ? " · gönderiye bağlı" : ""}
                    </span>
                  </div>
                  <AiContentDeleteButton id={item.id} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
