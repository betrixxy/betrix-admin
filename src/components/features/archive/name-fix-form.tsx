"use client";

import { renamePersonAction } from "@/app/dashboard/library/archive-actions";
import { approveTeamColorAction, setVenueNameAction } from "@/app/dashboard/library/names/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useActionForm } from "@/hooks/use-action-form";
import type { ArchiveActionState } from "@/types/archive";

/** Ad raporu satırı: öneriyle dolu düzeltme alanı (kişi → Person.nameOverride, stadyum → VenueName). */

const INITIAL: ArchiveActionState = {};

function Feedback({ state }: { state: ArchiveActionState }) {
  if (state.error) return <span className="text-xs text-red-400">{state.error}</span>;
  return state.notice ? <span className="text-xs text-emerald-400">{state.notice}</span> : null;
}

export function PersonNameFix({ personId, suggestion }: { personId: string; suggestion: string }) {
  const form = useActionForm(renamePersonAction, INITIAL);
  return (
    <form onSubmit={form.onSubmit} className="flex items-center gap-2">
      <input type="hidden" name="personId" value={personId} />
      <Input name="nameOverride" aria-label="Düzeltilmiş ad" defaultValue={suggestion} maxLength={120} className="h-7" />
      <Button type="submit" size="xs" variant="outline" disabled={form.isPending}>
        Kaydet
      </Button>
      <Feedback state={form.state} />
    </form>
  );
}

export function VenueNameFix({ apiName, suggestion }: { apiName: string; suggestion: string }) {
  const form = useActionForm(setVenueNameAction, INITIAL);
  return (
    <form onSubmit={form.onSubmit} className="flex items-center gap-2">
      <input type="hidden" name="apiName" value={apiName} />
      <Input name="displayName" aria-label="Stadyumun kart adı" defaultValue={suggestion} maxLength={80} className="h-7" />
      <Button type="submit" size="xs" variant="outline" disabled={form.isPending}>
        Kaydet
      </Button>
      <Feedback state={form.state} />
    </form>
  );
}

/** Otomatik takım rengi satırı: logodan çıkan iki renk (düzeltilebilir) → Onayla (`TeamColor` APPROVED). */
export function TeamColorFix({ teamId, primary, secondary }: { teamId: number; primary: string; secondary: string }) {
  const form = useActionForm(approveTeamColorAction, INITIAL);
  return (
    <form onSubmit={form.onSubmit} className="flex items-center gap-2">
      <input type="hidden" name="teamId" value={teamId} />
      <Input name="primary" type="color" aria-label="Birincil renk" defaultValue={primary.toLowerCase()} className="h-7 w-12 p-0.5" />
      <Input name="secondary" type="color" aria-label="İkincil renk" defaultValue={secondary.toLowerCase()} className="h-7 w-12 p-0.5" />
      <Button type="submit" size="xs" variant="outline" disabled={form.isPending}>
        Onayla
      </Button>
      <Feedback state={form.state} />
    </form>
  );
}
