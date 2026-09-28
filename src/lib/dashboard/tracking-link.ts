import { format } from "date-fns";
import { POST_ATTRIBUTION_PARAM } from "@/lib/dashboard/tracker-snippet";
import type { SocialPlatformType } from "@/types/social";
import type { Fixture } from "@/types/sports";

/**
 * Gönderi başına checkmatch.net takip linki — CLAUDE.md 4.3 UTM standardı + `cm_post`
 * (tıklamayı `SocialPost`'a bağlar; izleme kodu bunu okuyup `/api/track`'e iletir). Linkler
 * yalnızca bu fonksiyondan üretilir; elle string birleştirme yapılmaz (bkz. CLAUDE.md 4.3).
 */

export const CHECKMATCH_BASE_URL = "https://checkmatch.net";

const UTM_SOURCE: Record<SocialPlatformType, string> = {
  META_INSTAGRAM: "instagram",
  META_FACEBOOK: "facebook",
  TIKTOK: "tiktok",
  YOUTUBE: "youtube",
  X: "x",
};

/** "Beşiktaş" → "besiktas" — kebab-case ASCII (bkz. CLAUDE.md 4.3 utm_campaign). */
export function toSlug(value: string): string {
  return value
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** `<ev>-vs-<deplasman>-<YYYYMMDD>` — maç verisi çözülemezse fikstür kimliğine düşer. */
export function buildCampaignSlug(fixture: Fixture | null, fixtureId: string): string {
  if (!fixture) return toSlug(fixtureId);
  const date = format(new Date(fixture.kickoffUtc), "yyyyMMdd");
  return `${toSlug(fixture.homeTeam.name)}-vs-${toSlug(fixture.awayTeam.name)}-${date}`;
}

export interface TrackingLinkInput {
  postId: string;
  platform: SocialPlatformType;
  campaign: string;
  /** checkmatch.net'teki hedef yol — varsayılan ana sayfa. */
  path?: string;
}

export function buildTrackingLink({ postId, platform, campaign, path = "/" }: TrackingLinkInput): string {
  const url = new URL(path, CHECKMATCH_BASE_URL);
  url.searchParams.set("utm_source", UTM_SOURCE[platform]);
  url.searchParams.set("utm_medium", "social");
  url.searchParams.set("utm_campaign", campaign);
  url.searchParams.set(POST_ATTRIBUTION_PARAM, postId);
  return url.toString();
}
