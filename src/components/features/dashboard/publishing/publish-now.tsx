"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, ExternalLink, LoaderCircle, Rocket } from "lucide-react";
import { publishDraftAction } from "@/app/dashboard/drafts/[id]/publish-action";
import { Button } from "@/components/ui/button";
import { PUBLISH_PLATFORM_DEFS, type PublishedInfo, type PublishLayout, type PublishPlatform, type PublishTarget } from "@/types/publishing";

interface PublishNowProps {
  id: string;
  platform: PublishPlatform;
  layout: PublishLayout;
  mediaOrder: string[];
  caption: string;
  target: PublishTarget;
  /** Metin yazılırken/karar verilirken paylaşım kilitli. */
  blocked: boolean;
}

/**
 * "Hemen Paylaş": seçilen platforma API ile anında paylaşır. Dışa dönük ve geri alınamaz olduğu için iki
 * adımlıdır (buton → hesap + görsel sayısı özetiyle satır içi onay); tarayıcı diyaloğu kullanılmaz.
 */
export function PublishNow({ id, platform, layout, mediaOrder, caption, target, blocked }: PublishNowProps) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [published, setPublished] = useState<PublishedInfo | null>(null);
  const [isPublishing, startPublishing] = useTransition();
  const def = PUBLISH_PLATFORM_DEFS[platform];

  function publish() {
    setError(null);
    startPublishing(async () => {
      const result = await publishDraftAction({ id, platform, layout, mediaOrder, caption });
      setConfirming(false);
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setPublished(result.data);
      router.refresh();
    });
  }

  if (published) {
    return (
      <a href={published.url} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-1.5 rounded-lg border border-sky-400/40 bg-sky-400/10 px-3 py-2 text-sm text-sky-200">
        <ExternalLink className="size-4" />
        {def.label} gönderisi yayında — aç
      </a>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {confirming ? (
        <div className="flex flex-col gap-2 rounded-lg border border-sky-400/40 bg-sky-400/10 p-3 text-sm" role="alertdialog" aria-label="Paylaşımı onayla">
          <p>
            <strong>{def.label}</strong>
            {target.accountName ? ` (${target.accountName})` : ""} hesabına {mediaOrder.length} görselle şimdi paylaşılacak. Bu işlem geri alınamaz.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" disabled={isPublishing} onClick={publish} className="bg-sky-600 text-white hover:bg-sky-500">
              {isPublishing ? <LoaderCircle className="animate-spin" /> : <Rocket />}
              {isPublishing ? "Paylaşılıyor…" : "Evet, paylaş"}
            </Button>
            <Button type="button" variant="outline" disabled={isPublishing} onClick={() => setConfirming(false)}>
              Vazgeç
            </Button>
          </div>
        </div>
      ) : (
        <Button
          type="button"
          disabled={!target.available || blocked || !caption.trim() || mediaOrder.length === 0}
          onClick={() => setConfirming(true)}
          className="bg-sky-600 text-white hover:bg-sky-500"
          title={target.reason ?? undefined}
        >
          <Rocket />
          Hemen Paylaş ({def.label})
        </Button>
      )}
      {!target.available && target.reason ? <p className="text-[11px] text-muted-foreground">{target.reason}</p> : null}
      {error ? (
        <p className="flex items-start gap-1.5 text-xs text-destructive" role="alert">
          <AlertCircle className="mt-px size-3.5 shrink-0" />
          {error}
        </p>
      ) : null}
    </div>
  );
}
