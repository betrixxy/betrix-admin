import type { SocialPlatformType } from "@/types/social";
import { PLATFORM_SLUGS, type PlatformSlug } from "@/types/social-connection";

/** URL kısa adı ↔ prisma enum eşlemesi — sunucu bağımlılığı yok, istemcide de kullanılabilir. */
export const SLUG_TO_PLATFORM: Record<PlatformSlug, SocialPlatformType> = {
  instagram: "META_INSTAGRAM",
  facebook: "META_FACEBOOK",
  tiktok: "TIKTOK",
  youtube: "YOUTUBE",
  x: "X",
};

export const PLATFORM_TO_SLUG: Record<SocialPlatformType, PlatformSlug> = {
  META_INSTAGRAM: "instagram",
  META_FACEBOOK: "facebook",
  TIKTOK: "tiktok",
  YOUTUBE: "youtube",
  X: "x",
};

export function parsePlatformSlug(value: unknown): PlatformSlug | null {
  return PLATFORM_SLUGS.find((slug) => slug === value) ?? null;
}
