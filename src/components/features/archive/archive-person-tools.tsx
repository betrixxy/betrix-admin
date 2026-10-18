"use client";

import { useTransition, useState } from "react";
import { renamePersonAction, resolveTransferAction, syncArchiveAction, transferPersonAction } from "@/app/dashboard/library/archive-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { useActionForm } from "@/hooks/use-action-form";
import type { PendingTransfer, PersonHeader } from "@/lib/archive/queries";
import type { ArchiveActionState } from "@/types/archive";

const INITIAL: ArchiveActionState = {};

function Feedback({ state }: { state: ArchiveActionState }) {
  if (state.error) return <p className="text-[11px] text-destructive" role="alert">{state.error}</p>;
  if (state.notice) return <p className="text-[11px] text-emerald-400" role="status">{state.notice}</p>;
  return null;
}

/** Kişi araçları: "resmi adı düzelt" (kalıcı, senkron ezmez) ve elle "Takımını değiştir". */
export function ArchivePersonTools({ person, teams }: { person: PersonHeader; teams: { id: number; name: string }[] }) {
  const rename = useActionForm(renamePersonAction, INITIAL);
  const transfer = useActionForm(transferPersonAction, INITIAL);
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <form onSubmit={rename.onSubmit} className="flex flex-col gap-1.5">
        <input type="hidden" name="personId" value={person.id} />
        <Label htmlFor="nameOverride">Resmi adı düzelt</Label>
        <Input id="nameOverride" name="nameOverride" defaultValue={person.nameOverride ?? ""} placeholder={person.officialName} maxLength={120} />
        <span className="text-[11px] text-muted-foreground">API&apos;den türetilen: {person.officialName}. Boş bırakılırsa o kullanılır.</span>
        <Feedback state={rename.state} />
        <Button type="submit" size="sm" variant="outline" disabled={rename.isPending}>Adı kaydet</Button>
      </form>
      <form onSubmit={transfer.onSubmit} className="flex flex-col gap-1.5">
        <input type="hidden" name="personId" value={person.id} />
        <Label htmlFor="transfer-team">Takımını değiştir</Label>
        <NativeSelect id="transfer-team" name="teamId" defaultValue={person.currentTeamId ? String(person.currentTeamId) : ""}>
          <option value="" disabled>Takım seçin…</option>
          {teams.map((team) => (
            <option key={team.id} value={team.id}>{team.name}</option>
          ))}
        </NativeSelect>
        <span className="text-[11px] text-muted-foreground">Eski kulüp klasöründeki fotoğraflar yeni klasöre geçer; formaları aynı kalır (&quot;eski forma&quot; rozeti).</span>
        <Feedback state={transfer.state} />
        <Button type="submit" size="sm" variant="outline" disabled={transfer.isPending}>Taşı</Button>
      </form>
    </div>
  );
}

/** "Taşınsın mı?" önerileri — senkronun gördüğü kadro değişiklikleri; otomatik taşıma yok. */
export function ArchiveTransferSuggestions({ items }: { items: PendingTransfer[] }) {
  const [message, setMessage] = useState<ArchiveActionState>({});
  const [isPending, startTransition] = useTransition();
  // Son öneri çözülünce liste boşalır; sonuç mesajı görünsün diye panel mesaj varken kalır.
  if (items.length === 0 && !message.notice && !message.error) return null;
  const resolve = (personId: string, accept: boolean) => startTransition(async () => setMessage(await resolveTransferAction(personId, accept)));
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
      <span className="text-xs font-medium text-amber-300">Kadro değişikliği — taşınsın mı?</span>
      {items.map((item) => (
        <div key={item.personId} className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-white">{item.name}</span>
          <span className="text-muted-foreground">{item.fromTeam ?? "takımsız"} → {item.toTeam}</span>
          <Button size="sm" variant="outline" className="ml-auto h-7" disabled={isPending} onClick={() => resolve(item.personId, true)}>Taşı</Button>
          <Button size="sm" variant="ghost" className="h-7" disabled={isPending} onClick={() => resolve(item.personId, false)}>Yoksay</Button>
        </div>
      ))}
      <Feedback state={message} />
    </div>
  );
}

/** Kadro senkronu (yalnızca API okuması): seçili takım ya da Trendyol Süper Lig + 1. Lig. */
export function ArchiveSyncForm({ teamId, teamName }: { teamId: number | null; teamName: string | null }) {
  const { state, isPending, onSubmit } = useActionForm(syncArchiveAction, INITIAL);
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-1.5">
      <input type="hidden" name="teamId" value={teamId ?? ""} />
      <Button type="submit" size="sm" variant="outline" disabled={isPending}>
        {isPending ? "Senkronlanıyor…" : teamId ? `${teamName} kadrosunu yenile` : "Türk liglerini senkronla"}
      </Button>
      <span className="text-[11px] text-muted-foreground">{teamId ? "Kadro + teknik direktör (yaklaşık 4-5 API isteği)." : "Trendyol Süper Lig + 1. Lig (~38 takım, ~190 API isteği; son 7 günde senkronlananlar atlanır)."}</span>
      <Feedback state={state} />
    </form>
  );
}
