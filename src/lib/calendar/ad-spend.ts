import { AD_PLATFORM_ORDER } from "@/lib/calendar/ad-platform";
import type { AdPlatform, AdSpend } from "@/types/calendar";

export function totalAdSpend(adSpend: AdSpend): number {
  return AD_PLATFORM_ORDER.reduce((sum, platform) => sum + (adSpend[platform] ?? 0), 0);
}

/** Manuel bütçe formunda hangi platformların "aktif" sayılacağını tutardan türetir. */
export function derivePlatformsFromAdSpend(adSpend: AdSpend): AdPlatform[] {
  return AD_PLATFORM_ORDER.filter((platform) => (adSpend[platform] ?? 0) > 0);
}

/** Örn: 1500 -> "1.500 ₺" (tr-TR yerelleştirmesi, bkz. CRM'in TL standardı). */
export function formatAdSpend(amount: number): string {
  return `${new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 }).format(amount)} ₺`;
}
