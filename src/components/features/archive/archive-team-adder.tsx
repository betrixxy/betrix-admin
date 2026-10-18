"use client";

import { useState, useTransition } from "react";
import { LoaderCircle, Search } from "lucide-react";
import { addTeamAction, searchTeamsAction } from "@/app/dashboard/library/archive-directory-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useActionForm } from "@/hooks/use-action-form";
import type { TeamInfo } from "@/lib/services/api-football/team-directory";
import type { ArchiveActionState } from "@/types/archive";

const INITIAL: ArchiveActionState = {};

type Hit = TeamInfo & { inArchive: boolean };

/** Bir arama sonucu: "Arşive ekle" takımı, kadrosunu ve teknik direktörünü API'den alır (yalnızca okuma). */
function TeamHit({ hit }: { hit: Hit }) {
  const { state, isPending, onSubmit } = useActionForm(addTeamAction, INITIAL);
  const added = hit.inArchive || Boolean(state.notice);
  return (
    <li className="flex flex-col gap-1 rounded-md border border-border/60 px-2 py-1.5">
      <form onSubmit={onSubmit} className="flex items-center gap-2">
        <input type="hidden" name="teamId" value={hit.id} />
        {hit.logo ? (
          // eslint-disable-next-line @next/next/no-img-element -- API-Football logo adresi
          <img src={hit.logo} alt="" className="size-5 shrink-0 object-contain" />
        ) : null}
        <span className="min-w-0 flex-1 truncate text-xs text-white">
          {hit.name} <span className="text-muted-foreground">· {hit.national ? "milli takım" : (hit.country ?? "ülke yok")}</span>
        </span>
        <Button type="submit" size="sm" variant="secondary" className="h-7 text-[11px]" disabled={isPending || added}>
          {isPending ? <LoaderCircle className="animate-spin" /> : added ? "Arşivde" : "Arşive ekle"}
        </Button>
      </form>
      {state.notice ? <p className="text-[11px] text-emerald-400">{state.notice}</p> : null}
      {state.error ? <p className="text-[11px] text-destructive">{state.error}</p> : null}
    </li>
  );
}

/**
 * "Etiket bekleyenler"de arşivde olmayan takım: API-Football'da adla ara, seç → takım, kadro ve
 * teknik direktör arşive girer (ligi o sezonun yurt içi ligi). Ör. Manchester United / Bruno Fernandes.
 */
export function ArchiveTeamAdder() {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSearching, startSearch] = useTransition();

  function search() {
    startSearch(async () => {
      const result = await searchTeamsAction(query);
      setError(result.error ?? null);
      setHits(result.hits ?? null);
    });
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
      <p className="text-xs text-white">Takım arşivde yok mu? API-Football&apos;da arayıp kadrosuyla ekleyin.</p>
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
          placeholder="Takım adı (ör. Manchester United)"
          className="h-8 text-xs"
        />
        <Button type="button" size="sm" onClick={search} disabled={isSearching || query.trim().length < 3}>
          {isSearching ? <LoaderCircle className="animate-spin" /> : <Search />} Ara
        </Button>
      </div>
      {error ? <p className="text-[11px] text-destructive">{error}</p> : null}
      {hits && hits.length === 0 ? <p className="text-[11px] text-muted-foreground">Sonuç yok.</p> : null}
      {hits && hits.length > 0 ? (
        <ul className="flex flex-col gap-1">
          {hits.map((hit) => (
            <TeamHit key={hit.id} hit={hit} />
          ))}
        </ul>
      ) : null}
    </div>
  );
}
