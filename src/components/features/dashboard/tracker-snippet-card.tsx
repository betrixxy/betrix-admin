import { Code2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buildTrackerSnippet } from "@/lib/dashboard/tracker-snippet";
import { CopyTextButton } from "./copy-text-button";

interface TrackerSnippetCardProps {
  panelOrigin: string;
  siteKey: string;
  allowedOrigins: string[];
  /** Hiç trafik kaydı yokken kart açık gelir — kurulum henüz yapılmamış demektir. */
  defaultOpen: boolean;
}

/** checkmatch.net'e eklenecek izleme kodu — tek kaynak `lib/dashboard/tracker-snippet.ts`. */
export function TrackerSnippetCard({ panelOrigin, siteKey, allowedOrigins, defaultOpen }: TrackerSnippetCardProps) {
  const snippet = buildTrackerSnippet({ panelOrigin, siteKey });

  return (
    <Card>
      <details open={defaultOpen} className="group">
        <summary className="cursor-pointer list-none">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Code2 className="size-4 text-emerald-400" />
              checkmatch.net İzleme Kodu
            </CardTitle>
            <CardDescription>
              Bu kodu checkmatch.net&apos;in tüm sayfalarında <code>&lt;/body&gt;</code> etiketinden hemen önce ekleyin.
              <span className="group-open:hidden"> — göstermek için tıklayın</span>
            </CardDescription>
          </CardHeader>
        </summary>
        <CardContent className="flex flex-col gap-3">
          <pre className="max-h-80 overflow-auto rounded-lg bg-black/40 p-3 text-[11px] leading-relaxed text-emerald-100/90">
            {snippet}
          </pre>
          <CopyTextButton text={snippet} label="Kodu kopyala" />
          <ul className="flex flex-col gap-1 text-[11px] text-muted-foreground">
            <li>
              Uç nokta: <code className="text-white">{panelOrigin}/api/track</code>
            </li>
            <li>
              Kabul edilen kaynaklar (<code>TRACK_ALLOWED_ORIGINS</code>):{" "}
              <span className="text-white">{allowedOrigins.join(", ") || "—"}</span>
            </li>
            <li>
              Site anahtarı (<code>TRACK_SITE_KEY</code>): {siteKey ? "tanımlı, koda gömüldü" : "tanımsız — yalnızca kaynak (origin) kontrolü yapılır"}
            </li>
            <li>
              Sosyal medya atfı için paylaşımlarda İçerik Takvimi&apos;ndeki gönderinin <span className="text-white">takip linkini</span> kullanın.
            </li>
          </ul>
        </CardContent>
      </details>
    </Card>
  );
}
