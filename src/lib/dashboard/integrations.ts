import type { SocialPlatformType } from "@/types/social";

export interface IntegrationDef {
  id: string;
  name: string;
  description: string;
  platforms: readonly SocialPlatformType[];
  /** Şu an hiçbir entegrasyon canlı değil; API bağlandığında "connected" olur. */
  status: "not_connected" | "connected";
}

/**
 * Metrik ve reklam verisini çekecek gelecekteki API bağlantıları (bkz. CLAUDE.md 4.1 —
 * `lib/services/meta|tiktok|youtube|x`). Yeni bir sağlayıcı eklemek için bu listeye satır eklemek yeterli.
 */
export const INTEGRATIONS: readonly IntegrationDef[] = [
  {
    id: "meta",
    name: "Meta (Instagram + Facebook)",
    description: "Graph API ile erişim, kaydetme ve izlenme; Marketing API ile reklam harcaması.",
    platforms: ["META_INSTAGRAM", "META_FACEBOOK"],
    status: "not_connected",
  },
  {
    id: "tiktok",
    name: "TikTok",
    description: "Content/Business API ile izlenme, ortalama izlenme süresi ve reklam performansı.",
    platforms: ["TIKTOK"],
    status: "not_connected",
  },
  {
    id: "youtube",
    name: "YouTube",
    description: "Data + Analytics API ile izlenme süresi ve abone kazanımı.",
    platforms: ["YOUTUBE"],
    status: "not_connected",
  },
  {
    id: "x",
    name: "X (Twitter)",
    description: "X API v2 ile gösterim, yeniden paylaşım ve profil tıklamaları.",
    platforms: ["X"],
    status: "not_connected",
  },
];
