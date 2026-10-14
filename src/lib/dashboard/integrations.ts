import { listConnections, toConnectionView } from "@/lib/services/social/connections";
import { isProviderConfigured } from "@/lib/services/social/oauth-providers";
import { PLATFORM_TO_SLUG } from "@/lib/services/social/platforms";
import { SOCIAL_PLATFORM_TYPES, type SocialPlatformType } from "@/types/social";
import type { IntegrationStatus } from "@/types/social-connection";

interface IntegrationDef {
  name: string;
  description: string;
  /** `adapter.ts` hesap bilgisi NOT_IMPLEMENTED ise bağlantı her zaman başarısız olur. */
  comingSoon?: true;
}

/** Platform başına OAuth bağlantısı (bkz. CLAUDE.md 4.1). Instagram ve Facebook aynı Meta uygulamasını kullanır. */
const INTEGRATION_DEFS: Record<SocialPlatformType, IntegrationDef> = {
  META_INSTAGRAM: {
    name: "Instagram",
    description: "Graph API: beğeni, yorum, paylaşım, kaydetme, erişim, izlenme.",
  },
  META_FACEBOOK: {
    name: "Facebook",
    description: "Graph API: tepki, yorum, paylaşım, erişim ve gösterim.",
    comingSoon: true,
  },
  TIKTOK: {
    name: "TikTok",
    description: "Display API: izlenme, beğeni, yorum, paylaşım.",
  },
  YOUTUBE: {
    name: "YouTube",
    description: "Data + Analytics API: izlenme, beğeni, yorum, izlenme süresi.",
  },
  X: {
    name: "X (Twitter)",
    description: "X API v2: gösterim, beğeni, yanıt, yeniden paylaşım, yer imi.",
  },
};

/** Her platform için bağlantı durumu — token'lar bu görünüme asla girmez. */
export async function getIntegrationStatuses(): Promise<IntegrationStatus[]> {
  const connections = await listConnections();
  const byPlatform = new Map(connections.map((row) => [row.platform, toConnectionView(row)]));

  return SOCIAL_PLATFORM_TYPES.map((platform) => {
    const slug = PLATFORM_TO_SLUG[platform];
    const { name, description, comingSoon } = INTEGRATION_DEFS[platform];
    return {
      platform,
      slug,
      name,
      description,
      configured: isProviderConfigured(slug),
      comingSoon: comingSoon ?? false,
      connection: byPlatform.get(platform) ?? null,
    };
  });
}
