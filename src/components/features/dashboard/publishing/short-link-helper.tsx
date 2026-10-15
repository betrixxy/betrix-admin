"use client";

import { useState, useTransition } from "react";
import { Link2 } from "lucide-react";
import { draftShortLinkAction } from "@/app/dashboard/drafts/actions";
import { Button } from "@/components/ui/button";
import type { PublishPlatform } from "@/types/publishing";
import { CopyTextButton } from "../copy-text-button";

interface ShortLinkHelperProps {
  id: string;
  platform: PublishPlatform;
  /** Kısa linki metnin sonuna ekler. */
  onInsert: (url: string) => void;
}

/**
 * Kısa link (`/r/<kod>` → checkmatch.net, UTM'li) — yalnızca X ve Instagram story; Instagram akış açıklamasında
 * link tıklanmadığı için gösterilmez (bkz. CLAUDE.md 4.3). X'te linkli gönderi ~13 kat pahalıdır (4.5).
 */
export function ShortLinkHelper({ id, platform, onInsert }: ShortLinkHelperProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  if (platform === "IG_POST") return null;

  function create() {
    setError(null);
    startTransition(async () => {
      const result = await draftShortLinkAction(id, platform);
      if (result.ok) setUrl(result.data.url);
      else setError(result.error.message);
    });
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-white/10 bg-white/[0.02] p-3 text-xs">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Link2 className="size-3.5" />
        <span>
          {platform === "X"
            ? "Siteye dönüşü ölçmek için kısa link. Not: X'te linkli gönderi $0.20, linksiz $0.015."
            : "Story bağlantı çıkartmasına bu kısa linki ekleyin (açıklamaya değil)."}
        </span>
      </div>
      {url ? (
        <div className="flex flex-wrap items-center gap-2">
          <code className="rounded bg-black/30 px-2 py-1 text-[11px] text-white">{url}</code>
          <CopyTextButton text={url} label="Kopyala" />
          {platform === "X" ? (
            <Button type="button" size="sm" variant="outline" onClick={() => onInsert(url)}>
              Metne ekle
            </Button>
          ) : null}
        </div>
      ) : (
        <Button type="button" size="sm" variant="outline" disabled={isPending} onClick={create} className="self-start">
          {isPending ? "Oluşturuluyor…" : "Kısa link oluştur"}
        </Button>
      )}
      {error ? <p className="text-destructive">{error}</p> : null}
    </div>
  );
}
