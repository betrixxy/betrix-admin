"use client";

import { useState, useTransition } from "react";
import { Plus, X } from "lucide-react";
import { searchDrawTeamsAction } from "@/app/dashboard/studio/draw/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cardTeamName } from "@/lib/archive/names";
import { matchesQuery } from "@/lib/text-fold";
import type { DrawState, DrawTeam } from "@/types/draw";

/**
 * Kura öncesi hazırlık: katılımcılar (API'den yüklenen ya da elle eklenen), torba numarası ve kart adı
 * düzeltmesi. Kart adı boşsa yayıncı adı tablosu (`names.ts`) kullanılır; düzeltme yalnızca bu kurada geçerli.
 */

interface DrawParticipantsProps {
  state: DrawState;
  onChange: (state: DrawState) => void;
}

export function DrawParticipants({ state, onChange }: DrawParticipantsProps) {
  const [filter, setFilter] = useState("");
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<DrawTeam[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [isSearching, startSearch] = useTransition();
  const inUse = (id: number) => state.ties.some((t) => t.first === id || t.second === id) || state.fixtures.some((f) => f.teamId === id || f.opponentId === id);

  const setTeam = (id: number, patch: Partial<DrawTeam>) => onChange({ ...state, teams: state.teams.map((team) => (team.id === id ? { ...team, ...patch } : team)) });
  const setOverride = (id: number, value: string) => {
    const nameOverrides = { ...state.nameOverrides };
    if (value.trim()) nameOverrides[id] = value;
    else delete nameOverrides[id];
    onChange({ ...state, nameOverrides });
  };

  function search() {
    startSearch(async () => {
      const result = await searchDrawTeamsAction(query);
      if (!result.ok) return setMessage(result.error.message);
      setFound(result.data);
      setMessage(result.data.length ? null : "Sonuç yok.");
    });
  }

  const visible = state.teams.filter((team) => !filter.trim() || matchesQuery(`${team.apiName} ${cardTeamName(team.apiName)}`, filter));
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Input name="draw-participant-filter" value={filter} onChange={(event) => setFilter(event.target.value)} placeholder={`${state.teams.length} katılımcı içinde süz…`} className="h-8" />
      </div>
      {filter.trim() && visible.length < state.teams.length ? (
        <p className="flex items-center gap-2 text-xs text-amber-300">
          Süzgeç &quot;{filter}&quot;: {visible.length}/{state.teams.length} katılımcı gösteriliyor.
          <button type="button" onClick={() => setFilter("")} className="underline hover:text-foreground">
            Süzgeci temizle
          </button>
        </p>
      ) : null}
      <div className="max-h-80 overflow-y-auto rounded-lg border border-border/60">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-background text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-2 py-1.5 font-medium">API adı</th>
              <th className="px-2 py-1.5 font-medium">Kart adı</th>
              <th className="w-16 px-2 py-1.5 font-medium">Torba</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {visible.map((team) => (
              <tr key={team.id}>
                <td className="truncate px-2 py-1 text-xs text-muted-foreground" title={team.country ?? ""}>
                  {team.apiName}
                </td>
                <td className="px-2 py-1">
                  <input
                    autoComplete="off"
                    aria-label={`${team.apiName} kart adı`}
                    value={state.nameOverrides[team.id] ?? ""}
                    placeholder={cardTeamName(team.apiName)}
                    maxLength={40}
                    onChange={(event) => setOverride(team.id, event.target.value)}
                    className="h-7 w-full rounded-md border border-transparent bg-transparent px-1.5 text-sm hover:border-input focus:border-input focus:outline-none"
                  />
                </td>
                <td className="px-2 py-1">
                  <input
                    autoComplete="off"
                    type="number"
                    min={1}
                    max={6}
                    aria-label={`${team.apiName} torba`}
                    value={team.pot ?? ""}
                    onChange={(event) => setTeam(team.id, { pot: event.target.value ? Math.min(6, Math.max(1, Number(event.target.value))) : null })}
                    className="h-7 w-12 rounded-md border border-input bg-transparent px-1.5 text-sm"
                  />
                </td>
                <td className="px-1">
                  <button
                    type="button"
                    disabled={inUse(team.id)}
                    title={inUse(team.id) ? "Eşleşmede — önce eşleşmeyi silin" : "Katılımcıdan çıkar"}
                    onClick={() => onChange({ ...state, teams: state.teams.filter((t) => t.id !== team.id) })}
                    className="text-muted-foreground hover:text-red-400 disabled:opacity-30"
                  >
                    <X className="size-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <form
        className="flex items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          search();
        }}
      >
        <Input name="draw-team-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Elle ekle: API'de takım ara…" className="h-8" />
        <Button type="submit" size="sm" variant="outline" disabled={isSearching || query.trim().length < 3}>
          Ara
        </Button>
      </form>
      {message ? <p className="text-xs text-muted-foreground">{message}</p> : null}
      {found.length ? (
        <ul className="flex flex-col divide-y divide-border/50 rounded-lg border border-border/60 text-sm">
          {found.map((team) => {
            const exists = state.teams.some((t) => t.id === team.id);
            return (
              <li key={team.id} className="flex items-center justify-between gap-2 px-3 py-1">
                <span className="truncate">
                  {team.apiName} <span className="text-xs text-muted-foreground">· {team.country}</span>
                </span>
                <Button type="button" size="xs" variant="ghost" disabled={exists} onClick={() => onChange({ ...state, teams: [...state.teams, team] })}>
                  <Plus />
                  {exists ? "Ekli" : "Ekle"}
                </Button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
