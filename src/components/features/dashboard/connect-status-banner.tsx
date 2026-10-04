import { AlertCircle, CheckCircle2 } from "lucide-react";
import { PLATFORM_LABELS } from "@/lib/dashboard/social-meta";
import { SLUG_TO_PLATFORM } from "@/lib/services/social/platforms";
import type { ConnectErrorCode, PlatformSlug } from "@/types/social-connection";

const ERROR_MESSAGES: Record<ConnectErrorCode, string> = {
  not_configured: "Bu platformun uygulama kimliği/sırrı .env'de tanımlı değil.",
  invalid_state: "Güvenlik doğrulaması başarısız (süresi dolmuş veya geçersiz istek). Lütfen tekrar deneyin.",
  denied: "Yetkilendirme platform ekranında iptal edildi.",
  token_exchange_failed: "Platform erişim token'ı veremedi. Uygulama ayarlarını ve geri dönüş adresini kontrol edin.",
  account_lookup_failed: "Token alındı ama hesap bilgisi okunamadı — hesap bağlanmadı.",
  encryption_unavailable: "SOCIAL_TOKEN_ENCRYPTION_KEY tanımlı değil; token güvenle saklanamadığı için bağlantı kurulmadı.",
};

export type ConnectStatus =
  | { kind: "connected"; slug: PlatformSlug }
  | { kind: "error"; slug: PlatformSlug; code: ConnectErrorCode };

/** OAuth callback'inin `/dashboard/analytics?connected=…` / `?connect_error=…` sonucunu gösterir. */
export function ConnectStatusBanner({ status }: { status: ConnectStatus }) {
  const platform = PLATFORM_LABELS[SLUG_TO_PLATFORM[status.slug]];

  if (status.kind === "connected") {
    return (
      <p className="flex items-center gap-2 rounded-lg bg-emerald-500/10 p-3 text-sm text-emerald-300" role="status">
        <CheckCircle2 className="size-4 shrink-0" />
        {platform} hesabı bağlandı. Metrikleri çekmek için &quot;Metrikleri senkronize et&quot;e basın.
      </p>
    );
  }
  return (
    <p className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive" role="alert">
      <AlertCircle className="size-4 shrink-0" />
      {platform} bağlanamadı: {ERROR_MESSAGES[status.code]}
    </p>
  );
}
