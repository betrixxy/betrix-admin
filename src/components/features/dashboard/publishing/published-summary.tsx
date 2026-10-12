"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { CopyTextButton } from "@/components/features/dashboard/copy-text-button";
import { RenderThumbnail } from "@/components/features/dashboard/render-thumbnail";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { AiContentStatus } from "@/types/ai-content";
import { PUBLISH_PLATFORM_DEFS, type PublishMedia, type PublishSettings } from "@/types/publishing";
import { downloadSequence } from "./download-sequence";

interface PublishedSummaryProps {
  status: AiContentStatus;
  reviewedAt: string | null;
  caption: string;
  media: PublishMedia[];
  publish: PublishSettings | null;
  downloadName: string;
}

/** Karara bağlanmış taslak: kaydedilen platform, görsel sırası (sırayla indirilebilir) ve son metin — değiştirilemez. */
export function PublishedSummary({ status, reviewedAt, caption, media, publish, downloadName }: PublishedSummaryProps) {
  const [isDownloading, setDownloading] = useState(false);
  const labels = new Map(media.map((item) => [item.url, item.label]));
  const ordered = publish ? publish.mediaOrder : media.slice(0, 1).map((item) => item.url);
  const decidedAt = reviewedAt ? ` (${new Date(reviewedAt).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" })})` : "";

  async function download() {
    setDownloading(true);
    try {
      await downloadSequence(ordered, downloadName);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{status === "APPROVED" ? "Yayına Hazır" : "Reddedildi"}</CardTitle>
        <CardDescription>
          Bu taslak karara bağlandı{decidedAt} — artık değiştirilemez.
          {publish ? ` Platform: ${PUBLISH_PLATFORM_DEFS[publish.platform].label}${publish.layout === "multi" && ordered.length > 1 ? ` · ${PUBLISH_PLATFORM_DEFS[publish.platform].multiLabel}` : ""}.` : ""}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {status === "APPROVED" && ordered.length > 0 ? (
          <>
            <ol className="flex flex-wrap gap-2">
              {ordered.map((url, index) => (
                <li key={url} className="flex items-center gap-2 rounded-lg border border-border/60 p-1.5 pr-3 text-xs">
                  <span className="flex size-5 items-center justify-center rounded-full bg-emerald-500/15 font-semibold text-emerald-300">{index + 1}</span>
                  <div className="size-10 overflow-hidden rounded-md bg-muted/30 ring-1 ring-border">
                    <RenderThumbnail src={url} alt={labels.get(url) ?? "Görsel"} iconClassName="size-4" />
                  </div>
                  {labels.get(url) ?? "Görsel"}
                </li>
              ))}
            </ol>
            <Button type="button" variant="outline" disabled={isDownloading} onClick={download}>
              <Download />
              {ordered.length > 1 ? `Görselleri sırayla indir (${ordered.length})` : "Görseli indir"}
            </Button>
          </>
        ) : null}
        <pre className="whitespace-pre-wrap rounded-lg bg-white/[0.03] p-3 font-mono text-xs leading-relaxed text-white">{caption}</pre>
        <CopyTextButton text={caption} />
      </CardContent>
    </Card>
  );
}
