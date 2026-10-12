"use client";

import { useState, useTransition } from "react";
import { Check, ImagePlus, LoaderCircle } from "lucide-react";
import { listGalleryAction } from "@/app/dashboard/drafts/[id]/publish-action";
import { RenderThumbnail } from "@/components/features/dashboard/render-thumbnail";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import type { GalleryItem } from "@/types/publishing";

interface GalleryPickerProps {
  draftId: string;
  /** Dizilimde zaten olan adresler — tekrar eklenmez. */
  existing: string[];
  /** Eklenebilecek en fazla görsel. */
  remaining: number;
  onAdd: (items: GalleryItem[]) => void;
  disabled?: boolean;
}

/**
 * "Galeriden Görsel Ekle": daha önce üretilmiş kartlar ve Fal.ai görselleri (Maç Günü, AI İçerik Stüdyosu)
 * yan çekmecede listelenir; seçilenler seçim sırasıyla dizilimin sonuna eklenir.
 */
export function GalleryPicker({ draftId, existing, remaining, onAdd, disabled }: GalleryPickerProps) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<GalleryItem[] | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [onlyAi, setOnlyAi] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, startLoading] = useTransition();

  function openPicker() {
    setOpen(true);
    setPicked([]);
    setError(null);
    startLoading(async () => {
      const result = await listGalleryAction(draftId);
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setItems(result.data);
    });
  }

  function toggle(url: string) {
    setPicked((current) => (current.includes(url) ? current.filter((value) => value !== url) : current.length < remaining ? [...current, url] : current));
  }

  const visible = (items ?? []).filter((item) => !existing.includes(item.url) && (!onlyAi || item.ai));

  function add() {
    const byUrl = new Map((items ?? []).map((item) => [item.url, item]));
    onAdd(picked.flatMap((url) => byUrl.get(url) ?? []));
    setOpen(false);
  }

  return (
    <>
      <Button type="button" variant="outline" size="sm" disabled={disabled || remaining <= 0} onClick={openPicker}>
        <ImagePlus />
        Galeriden Görsel Ekle
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="flex w-full flex-col gap-4 overflow-y-auto sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>Galeriden Görsel Ekle</SheetTitle>
            <SheetDescription>
              Daha önce üretilmiş kartlar ve AI görselleri. En fazla {remaining} görsel seçebilirsiniz; seçim sırası dizilim sırası olur.
            </SheetDescription>
          </SheetHeader>
          <div className="flex items-center justify-between gap-2 px-4">
            <div className="grid grid-cols-2 gap-1 rounded-lg bg-white/[0.04] p-1 text-xs" role="radiogroup" aria-label="Filtre">
              {([false, true] as const).map((value) => (
                <button
                  key={String(value)}
                  type="button"
                  role="radio"
                  aria-checked={onlyAi === value}
                  onClick={() => setOnlyAi(value)}
                  className={cn("rounded-md px-2.5 py-1", onlyAi === value ? "bg-white/10 text-foreground" : "text-muted-foreground hover:text-foreground")}
                >
                  {value ? "Yalnız Fal.ai üretimleri" : "Tümü"}
                </button>
              ))}
            </div>
            <span className="text-xs tabular-nums text-muted-foreground">
              {picked.length} / {remaining} seçili
            </span>
          </div>
          <div className="px-4">
            {isLoading ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <LoaderCircle className="size-4 animate-spin" />
                Galeri yükleniyor…
              </p>
            ) : error ? (
              <p className="text-sm text-destructive">{error}</p>
            ) : visible.length === 0 ? (
              <p className="text-sm text-muted-foreground">Eklenebilecek görsel yok.</p>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {visible.map((item) => {
                  const order = picked.indexOf(item.url);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => toggle(item.url)}
                      className={cn(
                        "relative flex flex-col gap-1 rounded-lg border p-1.5 text-left transition-colors",
                        order >= 0 ? "border-emerald-400/70 bg-emerald-400/10" : "border-border/60 hover:bg-white/[0.04]",
                      )}
                    >
                      <div className="aspect-square overflow-hidden rounded-md bg-muted/30">
                        <RenderThumbnail src={item.url} alt={item.label} iconClassName="size-5" />
                      </div>
                      <span className="line-clamp-2 text-[10px] leading-tight text-muted-foreground">{item.label}</span>
                      {order >= 0 ? (
                        <span className="absolute top-2.5 right-2.5 flex size-5 items-center justify-center rounded-full bg-emerald-500 text-[10px] font-semibold text-white">
                          {order + 1}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <div className="mt-auto flex gap-2 px-4 pb-4">
            <Button type="button" className="flex-1" disabled={picked.length === 0} onClick={add}>
              <Check />
              {picked.length > 0 ? `${picked.length} görseli ekle` : "Görsel seçin"}
            </Button>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Vazgeç
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
