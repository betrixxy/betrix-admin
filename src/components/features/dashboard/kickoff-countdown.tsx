"use client";

import { useSyncExternalStore } from "react";
import { formatCountdown } from "@/lib/dashboard/fixture-row";

const TICK_MS = 30 * 1000;

/** 30 sn'lik saat — anlık görüntü aralık içinde sabit kalır (her çizimde yeni değer üretmez). */
const subscribe = (onTick: () => void) => {
  const timer = setInterval(onTick, TICK_MS);
  return () => clearInterval(timer);
};
const clientTick = () => Math.floor(Date.now() / TICK_MS);
const serverTick = () => null;

/**
 * Başlamaya 24 saatten az kalan maçın geri sayımı ("2 sa 15 dk"). Saat yalnızca istemcide okunur;
 * sunucu çiziminde boş kalır (hidrasyon uyuşmazlığı olmasın), alan her durumda yer kaplar.
 */
export function KickoffCountdown({ kickoffUtc }: { kickoffUtc: string }) {
  const tick = useSyncExternalStore(subscribe, clientTick, serverTick);
  const label = tick === null ? null : formatCountdown(Date.parse(kickoffUtc) - tick * TICK_MS);
  if (!label) return null;
  return <span className="text-xs tabular-nums text-emerald-300" title="Başlamasına kalan süre">{label}</span>;
}
