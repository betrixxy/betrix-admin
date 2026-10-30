"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";

/**
 * Oyuncu verisinin kesinleşmesine geri sayım (`settle.ts::settledAt`). Süre dolunca `onReady` bir kez çağrılır
 * (istemci durumu yeniden sorar). `readyAt` yoksa (puanlar eksik) yalnızca sebep yazılır.
 */
export function SettleCountdown({ readyAt, reason, onReady }: { readyAt: string | null; reason: string; onReady?: () => void }) {
  const target = readyAt ? Date.parse(readyAt) : null;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (target === null) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [target]);
  const left = target === null ? null : Math.max(0, target - now);
  useEffect(() => {
    if (left === 0) onReady?.();
  }, [left, onReady]);
  const clock = left === null ? null : `${String(Math.floor(left / 60000)).padStart(2, "0")}:${String(Math.floor((left % 60000) / 1000)).padStart(2, "0")}`;
  return (
    <p className="flex items-start gap-1.5 rounded-md border border-sky-500/30 bg-sky-500/10 px-2.5 py-1.5 text-xs text-sky-200" role="status">
      <Clock className="mt-0.5 size-3.5 shrink-0" />
      <span>
        {clock !== null && left !== 0 ? <strong className="tabular-nums">Kesinleşmeye {clock} · </strong> : null}
        {left === 0 ? "Süre doldu — veri yeniden kontrol ediliyor." : reason}
      </span>
    </p>
  );
}
