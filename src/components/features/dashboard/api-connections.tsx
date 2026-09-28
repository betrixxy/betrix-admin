import { Plug } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { INTEGRATIONS } from "@/lib/dashboard/integrations";
import { PLATFORM_DOT_CLASS } from "@/lib/dashboard/social-meta";
import { cn } from "@/lib/utils";

/** Gelecekteki Meta/TikTok/YouTube/X bağlantılarının yer tutucusu — bağlantı akışı henüz yok. */
export function ApiConnections() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Plug className="size-4 text-violet-400" />
          API Bağlantıları
        </CardTitle>
        <CardDescription>Bağlandığında metrikler otomatik senkronize edilecek</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {INTEGRATIONS.map((integration) => (
          <div key={integration.id} className="flex items-start justify-between gap-3 rounded-lg bg-muted/30 p-3">
            <div className="flex min-w-0 flex-col gap-1">
              <span className="flex items-center gap-2 text-[13px] font-medium text-white">
                <span className="flex gap-1">
                  {integration.platforms.map((platform) => (
                    <span key={platform} className={cn("size-2 rounded-full", PLATFORM_DOT_CLASS[platform])} />
                  ))}
                </span>
                {integration.name}
              </span>
              <span className="text-[11px] text-muted-foreground">{integration.description}</span>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1.5">
              <Badge variant="outline">{integration.status === "connected" ? "Bağlı" : "Bağlı değil"}</Badge>
              <Button size="xs" variant="outline" disabled>
                Bağla (yakında)
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
