import { ISTANBUL_TZ } from "@/lib/metrics/istanbul-time";

/**
 * Yayın penceresi: başlama − 30 saat ile başlama − 6 saat. Geçen gerçek süre olarak hesaplanır; saat dilimi
 * yalnız gösterimi etkiler, bu yüzden yaz/kış saati geçişi pencere uzunluğunu değiştirmez.
 */

const HOUR_MS = 3_600_000;
export const PUBLISH_FROM_HOURS = 30;
export const PUBLISH_TO_HOURS = 6;

export interface PublishWindow {
  publishFrom: Date;
  publishTo: Date;
}

export function publishWindow(kickoffUtc: Date): PublishWindow {
  return {
    publishFrom: new Date(kickoffUtc.getTime() - PUBLISH_FROM_HOURS * HOUR_MS),
    publishTo: new Date(kickoffUtc.getTime() - PUBLISH_TO_HOURS * HOUR_MS),
  };
}

const dateTimeFormat = new Intl.DateTimeFormat("tr-TR", { timeZone: ISTANBUL_TZ, day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const timeFormat = new Intl.DateTimeFormat("tr-TR", { timeZone: ISTANBUL_TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

/** "01.11 19:00" (İstanbul). Parçalardan kurulur: ayırıcı Node'un ICU sürümüne bağlı kalmaz. */
export function formatIstanbulDateTime(at: Date): string {
  const part = (type: Intl.DateTimeFormatPartTypes) => dateTimeFormat.formatToParts(at).find((item) => item.type === type)?.value ?? "";
  return `${part("day")}.${part("month")} ${part("hour")}:${part("minute")}`;
}
/** "19:00" (İstanbul). */
export const formatIstanbulTime = (at: Date): string => timeFormat.format(at);

export const formatPublishWindow = (window: PublishWindow): string =>
  `${formatIstanbulDateTime(window.publishFrom)} – ${formatIstanbulDateTime(window.publishTo)}`;

function duration(ms: number): string {
  const minutes = Math.max(0, Math.floor(ms / 60_000));
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  if (days > 0) return `${days} g ${hours} sa`;
  if (hours > 0) return `${hours} sa ${minutes % 60} dk`;
  return `${minutes} dk`;
}

export type PublishWindowPhase = "BEFORE" | "OPEN" | "CLOSED";

export interface PublishWindowState {
  phase: PublishWindowPhase;
  label: string;
}

export function publishWindowState(window: PublishWindow, now: Date): PublishWindowState {
  if (now < window.publishFrom) return { phase: "BEFORE", label: `Pencere ${duration(window.publishFrom.getTime() - now.getTime())} sonra açılıyor` };
  if (now <= window.publishTo) return { phase: "OPEN", label: `Pencere açık, ${duration(window.publishTo.getTime() - now.getTime())} kaldı` };
  return { phase: "CLOSED", label: "Pencere kapandı" };
}
