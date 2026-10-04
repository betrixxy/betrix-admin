import { formatDistanceToNow } from "date-fns";
import { tr } from "date-fns/locale";
import { Plug } from "lucide-react";
import { disconnectSocialAction } from "@/app/dashboard/analytics/actions";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PLATFORM_DOT_CLASS } from "@/lib/dashboard/social-meta";
import { SYNC_CHECKPOINT_HOURS } from "@/lib/services/social/metrics/schedule";
import { cn } from "@/lib/utils";
import type { IntegrationStatus } from "@/types/social-connection";
import { SyncMetricsForm } from "./sync-metrics-form";

const ago = (iso: string) => formatDistanceToNow(new Date(iso), { addSuffix: true, locale: tr });

function IntegrationRow({ integration }: { integration: IntegrationStatus }) {
  const { connection } = integration;

  return (
    <div className="flex items-start justify-between gap-3 rounded-lg bg-muted/30 p-3">
      <div className="flex min-w-0 flex-col gap-1">
        <span className="flex items-center gap-2 text-[13px] font-medium text-white">
          <span className={cn("size-2 rounded-full", PLATFORM_DOT_CLASS[integration.platform])} />
          {integration.name}
        </span>
        <span className="text-[11px] text-muted-foreground">{integration.description}</span>
        {connection ? (
          <span className="text-[11px] text-muted-foreground">
            {connection.accountName ?? connection.accountId} · bağlandı {ago(connection.connectedAt)}
            {connection.lastSyncedAt ? ` · son senkronizasyon ${ago(connection.lastSyncedAt)}` : " · henüz senkronize edilmedi"}
          </span>
        ) : null}
        {connection?.lastSyncError ? (
          <span className="text-[11px] text-destructive">Son hata: {connection.lastSyncError}</span>
        ) : null}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1.5">
        <Badge variant="outline" className={connection ? "border-emerald-500/40 text-emerald-400" : undefined}>
          {connection ? "Bağlı" : "Bağlı değil"}
        </Badge>
        {connection ? (
          <form action={disconnectSocialAction}>
            <input type="hidden" name="platform" value={integration.slug} />
            <Button type="submit" size="xs" variant="outline">
              Bağlantıyı kopar
            </Button>
          </form>
        ) : integration.configured ? (
          // Tam sayfa gezinme: route handler sağlayıcıya yönlendirir (Link ön-yüklemesi istenmez).
          <a href={`/api/auth/${integration.slug}/connect`} className={buttonVariants({ size: "xs", variant: "outline" })}>
            Bağla
          </a>
        ) : (
          <Button size="xs" variant="outline" disabled title="Uygulama kimliği/sırrı .env'de tanımlı değil">
            Yapılandırılmadı
          </Button>
        )}
      </div>
    </div>
  );
}

interface ApiConnectionsProps {
  integrations: IntegrationStatus[];
  mockMode: boolean;
}

/** Sosyal hesap bağlantıları (OAuth) ve metrik senkronizasyonu. */
export function ApiConnections({ integrations, mockMode }: ApiConnectionsProps) {
  const connectedCount = integrations.filter((integration) => integration.connection).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Plug className="size-4 text-violet-400" />
          Hesap Bağlantıları
          {mockMode ? <Badge variant="outline">mock modu</Badge> : null}
        </CardTitle>
        <CardDescription>
          Metrikler yayından {SYNC_CHECKPOINT_HOURS.join(", ")} saat sonra kademeli çekilir.
          {mockMode ? " Mock modunda gerçek API'ye gidilmez; üretilen veriler \"mock veri\" olarak işaretlenir." : null}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <SyncMetricsForm disabled={connectedCount === 0} />
        {integrations.map((integration) => (
          <IntegrationRow key={integration.platform} integration={integration} />
        ))}
      </CardContent>
    </Card>
  );
}
