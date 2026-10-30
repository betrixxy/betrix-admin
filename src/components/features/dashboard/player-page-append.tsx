"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Info, UserPlus } from "lucide-react";
import { appendPlayerPageAction, playerPageStatusAction } from "@/app/dashboard/drafts/[id]/player-page-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { useActionForm } from "@/hooks/use-action-form";
import type { PendingPlayerPage } from "@/lib/player-stats/plan";
import type { PlayerDataSettlement, PlayerPageAppendState } from "@/types/player-match-stats";
import { JobProgressLine } from "./job-progress";
import { SettleCountdown } from "./settle-countdown";

const INITIAL: PlayerPageAppendState = {};

const pageValue = (pending: PendingPlayerPage | null) => (!pending || pending.template === "SPOTLIGHT" ? "SPOTLIGHT" : pending.count === 5 ? "TOP_5" : "TOP_3");

/**
 * Maç Sonucu taslağına oyuncu sayfasını SONRADAN ekleme (yayından önce): veri kesinleşene kadar geri sayım;
 * "Şimdi üret (veriler değişebilir)" uyarıyla. Ekleme arka plan işidir; bitince sayfa tazelenir.
 */
export function PlayerPageAppend({ draftId, pending, mvpId }: { draftId: string; pending: PendingPlayerPage | null; mvpId: number | null }) {
  const router = useRouter();
  const { state, isPending, onSubmit, progress } = useActionForm(appendPlayerPageAction, INITIAL);
  const [status, setStatus] = useState<PlayerDataSettlement | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [force, setForce] = useState(false);

  const check = useCallback(() => {
    playerPageStatusAction(draftId)
      .then((result) => (result.ok ? setStatus(result.data) : setStatusError(result.error.message)))
      .catch(() => setStatusError("Oyuncu verisi durumu okunamadı."));
  }, [draftId]);
  useEffect(check, [check]);
  useEffect(() => {
    if (state.done) router.refresh();
  }, [state.done, router]);

  const settled = status?.settled === true;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Oyuncu sayfasını ekle</CardTitle>
        <CardDescription>
          {pending ? "Bu taslak üretilirken oyuncu verisi kesinleşmemişti — sayfa hazır olunca eklenir. " : ""}
          Carousel&apos;in son sayfası olur (aynı format, vurgu rengi ve sütun tarafı). Yalnızca taslakta, yayından önce.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          <input type="hidden" name="draftId" value={draftId} />
          <input type="hidden" name="playerId" value={pending?.playerId ?? mvpId ?? ""} />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="page">Sayfa</Label>
            <NativeSelect id="page" name="page" defaultValue={pageValue(pending)}>
              <option value="SPOTLIGHT">A · Maçın Oyuncusu</option>
              <option value="TOP_3">B · Maçın En İyileri (3 oyuncu)</option>
              <option value="TOP_5">B · Maçın En İyileri (5 oyuncu)</option>
            </NativeSelect>
          </div>
          {statusError ? <p className="text-xs text-destructive">{statusError}</p> : null}
          {status && !status.settled ? (
            <>
              <SettleCountdown readyAt={status.readyAt} reason={status.reason} onReady={check} />
              <label className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-xs text-amber-200">
                <input type="checkbox" name="force" checked={force} onChange={(event) => setForce(event.target.checked)} className="mt-0.5" />
                <span>Şimdi üret (veriler değişebilir) — puanlar ve istatistikler kesinleşmeden çizilir, taslağa &quot;geçici&quot; notu düşer.</span>
              </label>
            </>
          ) : null}
          {state.error ? (
            <p className="flex items-center gap-1.5 text-xs text-destructive" role="alert">
              <AlertCircle className="size-3.5 shrink-0" />
              {state.error}
            </p>
          ) : null}
          {state.done
            ? (state.notes ?? []).map((note) => (
                <p key={note} className="flex items-center gap-1.5 text-xs text-amber-300">
                  <Info className="size-3.5 shrink-0" />
                  {note}
                </p>
              ))
            : null}
          <JobProgressLine progress={progress} />
          <Button type="submit" disabled={isPending || !status || (!settled && !force)}>
            <UserPlus />
            {isPending ? "Ekleniyor…" : "Oyuncu sayfasını ekle"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
