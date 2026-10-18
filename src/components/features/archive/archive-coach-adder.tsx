"use client";

import { useState, useTransition } from "react";
import { LoaderCircle, Search } from "lucide-react";
import { addCoachAction, searchCoachesAction } from "@/app/dashboard/library/archive-directory-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useActionForm } from "@/hooks/use-action-form";
import type { CoachSearchHit } from "@/lib/services/api-football/team-directory";
import type { ArchiveActionState } from "@/types/archive";

const INITIAL: ArchiveActionState = {};

/** API sonucu → "Ekle": ad sunucuda API'den yeniden alınır (formdaki ada güvenilmez). */
function CoachHit({ hit, teamId }: { hit: CoachSearchHit; teamId: number }) {
  const { state, isPending, onSubmit } = useActionForm(addCoachAction, INITIAL);
  return (
    <li className="flex flex-col gap-1 rounded-md border border-border/60 px-2 py-1.5">
      <form onSubmit={onSubmit} className="flex items-center gap-2">
        <input type="hidden" name="teamId" value={teamId} />
        <input type="hidden" name="coachId" value={hit.id} />
        <span className="min-w-0 flex-1 truncate text-xs text-white">
          {hit.name}
          <span className="text-muted-foreground"> · {[hit.nationality, hit.currentTeam ? `şu an: ${hit.currentTeam}` : null].filter(Boolean).join(" · ") || "bilgi yok"}</span>
        </span>
        <Button type="submit" size="sm" variant="secondary" className="h-7 text-[11px]" disabled={isPending || Boolean(state.notice)}>
          {isPending ? <LoaderCircle className="animate-spin" /> : state.notice ? "Eklendi" : "Ekle"}
        </Button>
      </form>
      {state.notice ? <p className="text-[11px] text-emerald-400">{state.notice}</p> : null}
      {state.error ? <p className="text-[11px] text-destructive">{state.error}</p> : null}
    </li>
  );
}

/** API'de bulunamayan teknik direktör: elle tam ad (sonradan "resmi adı düzelt" ile değişebilir). */
function ManualCoachForm({ teamId }: { teamId: number }) {
  const { state, isPending, onSubmit } = useActionForm(addCoachAction, INITIAL);
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-1">
      <input type="hidden" name="teamId" value={teamId} />
      <div className="flex gap-2">
        <Input name="name" placeholder="Tam ad (ör. Vincenzo Italiano)" maxLength={80} className="h-8 text-xs" required />
        <Button type="submit" size="sm" variant="secondary" disabled={isPending}>{isPending ? <LoaderCircle className="animate-spin" /> : "Elle ekle"}</Button>
      </div>
      {state.notice ? <p className="text-[11px] text-emerald-400">{state.notice}</p> : null}
      {state.error ? <p className="text-[11px] text-destructive">{state.error}</p> : null}
    </form>
  );
}

/**
 * Takım klasöründe "Teknik direktör ekle": API-Football'da adla ara (yalnızca okuma), seç → kişi
 * COACH olarak bu takıma eklenir. API'de yoksa elle tam ad girilir.
 */
export function ArchiveCoachAdder({ teamId }: { teamId: number }) {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<CoachSearchHit[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSearching, startSearch] = useTransition();

  function search() {
    startSearch(async () => {
      const result = await searchCoachesAction(query);
      setError(result.error ?? null);
      setHits(result.hits ?? null);
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              search();
            }
          }}
          placeholder="API-Football'da ara (soyadı yeterli)"
          className="h-8 text-xs"
        />
        <Button type="button" size="sm" onClick={search} disabled={isSearching || query.trim().length < 3}>
          {isSearching ? <LoaderCircle className="animate-spin" /> : <Search />} Ara
        </Button>
      </div>
      {error ? <p className="text-[11px] text-destructive">{error}</p> : null}
      {hits && hits.length === 0 ? <p className="text-[11px] text-muted-foreground">API&apos;de bulunamadı — aşağıdan elle ekleyin.</p> : null}
      {hits && hits.length > 0 ? (
        <ul className="flex flex-col gap-1">
          {hits.map((hit) => (
            <CoachHit key={hit.id} hit={hit} teamId={teamId} />
          ))}
        </ul>
      ) : null}
      <ManualCoachForm teamId={teamId} />
    </div>
  );
}
