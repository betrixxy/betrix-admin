import type { AdPlatform } from "@/types/calendar";

interface AdPlatformMeta {
  label: string;
  shortLabel: string;
  colorHex: string;
  description: string;
}

export const AD_PLATFORM_META: Record<AdPlatform, AdPlatformMeta> = {
  meta: {
    label: "Meta (IG/FB)",
    shortLabel: "M",
    colorHex: "#C13584",
    description: "Instagram ve Facebook reklamlarının birleşik bütçesi",
  },
  tiktok: {
    label: "TikTok",
    shortLabel: "T",
    colorHex: "#FE2C55",
    description: "TikTok reklam bütçesi",
  },
  youtube: {
    label: "YouTube",
    shortLabel: "Y",
    colorHex: "#FF0000",
    description: "YouTube reklam bütçesi",
  },
  x: {
    label: "X",
    shortLabel: "X",
    colorHex: "#000000",
    description: "X (Twitter) reklam bütçesi",
  },
};

export const AD_PLATFORM_ORDER: AdPlatform[] = ["meta", "tiktok", "youtube", "x"];
