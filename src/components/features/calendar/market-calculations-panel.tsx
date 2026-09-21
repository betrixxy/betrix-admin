"use client";

import { useState, useTransition } from "react";
import { AlertCircle, RadioTower } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getMatchCalculationsAction } from "@/app/calendar/actions";
import type { CheckmatchCoreError } from "@/lib/services/checkmatch-core";
import type { MatchCalculations } from "@/types/market";

interface MarketCalculationsPanelProps {
  fixtureId: string;
}

type PanelState =
  | { status: "idle" }
  | { status: "error"; error: CheckmatchCoreError }
  | { status: "success"; data: MatchCalculations };

const ERROR_MESSAGES: Record<CheckmatchCoreError["code"], string> = {
  NOT_CONFIGURED: "Mac sunucusu bağlantı bilgileri eksik — .env.local dosyasını kontrol edin.",
  TIMEOUT: "Mac sunucusundan yanıt alınamadı (timeout).",
  NETWORK: "Mac sunucusuna ulaşılamıyor — sunucunun çalıştığından emin olun.",
  HTTP_STATUS: "Mac sunucusu hata döndürdü.",
  INVALID_RESPONSE: "Mac sunucusu yanıtı beklenen formatta değil.",
};

/**
 * checkmatch-core VIP token'ıyla Mac sunucusundan canlı market/oran verisini çeker —
 * bkz. CLAUDE.md FAZ 5 (service-to-service VIP auth). Sunucu henüz ayakta değilse
 * NETWORK hatası beklenen davranıştır (sessizce boş göstermek yerine hata rozeti).
 */
export function MarketCalculationsPanel({ fixtureId }: MarketCalculationsPanelProps) {
  const [state, setState] = useState<PanelState>({ status: "idle" });
  const [isPending, startTransition] = useTransition();

  function handleFetch() {
    startTransition(async () => {
      const result = await getMatchCalculationsAction(fixtureId);
      setState(
        result.ok
          ? { status: "success", data: result.data }
          : { status: "error", error: result.error },
      );
    });
  }

  return (
    <div className="flex flex-col gap-2.5">
      <Button
        variant="outline"
        size="sm"
        onClick={handleFetch}
        disabled={isPending}
        className="w-fit gap-1.5"
      >
        <RadioTower className="size-3.5" />
        {isPending ? "Getiriliyor…" : "Canlı Market Verisini Getir"}
      </Button>

      {state.status === "error" && (
        <div className="flex items-center gap-1.5 rounded-md bg-destructive/10 px-2.5 py-2 text-xs text-destructive">
          <AlertCircle className="size-3.5 shrink-0" />
          {ERROR_MESSAGES[state.error.code]}
        </div>
      )}

      {state.status === "success" && (
        <div className="flex flex-col gap-2.5 rounded-lg bg-muted/30 p-3">
          {state.data.markets.map((market) => (
            <div key={market.market} className="flex flex-col gap-1.5">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {market.market}
              </span>
              <div className="flex flex-wrap gap-1.5">
                {market.selections.map((selection) => (
                  <span
                    key={selection.label}
                    className="rounded-md bg-white/[0.06] px-2 py-1 text-xs text-foreground/90"
                  >
                    {selection.label}{" "}
                    <span className="font-semibold text-foreground">{selection.odds}</span>
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
