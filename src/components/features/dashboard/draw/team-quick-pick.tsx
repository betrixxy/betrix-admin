"use client";

import { forwardRef, useMemo, useState, type KeyboardEvent } from "react";
import { matchesQuery } from "@/lib/text-fold";
import { cn } from "@/lib/utils";

/**
 * Kura sırasında hızlı takım seçimi — yaz → (↑/↓) → Enter. Liste her zaman açık; Enter vurgulu takımı seçer
 * ve kutuyu temizler (odak çağıranda: sıradaki alana geçer). Shift+Enter seçimi `alt` bayrağıyla bildirir
 * (lig aşamasında deplasman). Türkçe karakter duyarsız ("fenerb" → Fenerbahçe).
 */

export interface QuickPickTeam {
  id: number;
  name: string;
  /** Sağda soluk: torba, ülke. */
  meta: string;
  /** Seçilemez (zaten eşleşmede) — listede soluk. */
  disabled?: boolean;
}

interface TeamQuickPickProps {
  id: string;
  label: string;
  teams: QuickPickTeam[];
  onPick: (teamId: number, alt: boolean) => void;
  placeholder?: string;
  /** Önceden seçili takımın adı (eleme: ilk kutu seçildi, ikinci bekleniyor). */
  selectedName?: string | null;
}

const LIMIT = 8;

export const TeamQuickPick = forwardRef<HTMLInputElement, TeamQuickPickProps>(function TeamQuickPick({ id, label, teams, onPick, placeholder = "Takım yazın…", selectedName }, ref) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const matches = useMemo(() => {
    const found = query.trim() ? teams.filter((team) => matchesQuery(team.name, query)) : teams;
    // Seçilebilenler önde.
    return [...found.filter((team) => !team.disabled), ...found.filter((team) => team.disabled)].slice(0, LIMIT);
  }, [teams, query]);

  function pick(index: number, alt: boolean) {
    const team = matches[index];
    if (!team || team.disabled) return;
    onPick(team.id, alt);
    setQuery("");
    setActive(0);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") setActive((value) => Math.min(value + 1, matches.length - 1));
    else if (event.key === "ArrowUp") setActive((value) => Math.max(value - 1, 0));
    else if (event.key === "Enter") pick(active, event.shiftKey);
    else if (event.key === "Escape") setQuery("");
    else return;
    event.preventDefault();
  }

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-medium text-muted-foreground">
        {label}
        {selectedName ? <span className="ml-1 text-emerald-400">· {selectedName}</span> : null}
      </label>
      <input
        ref={ref}
        id={id}
        name={id}
        role="combobox"
        aria-expanded="true"
        aria-controls={`${id}-list`}
        aria-activedescendant={matches[active] ? `${id}-${matches[active].id}` : undefined}
        autoComplete="off"
        value={query}
        placeholder={placeholder}
        onChange={(event) => {
          setQuery(event.target.value);
          setActive(0);
        }}
        onKeyDown={onKeyDown}
        className="h-9 rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
      />
      <ul id={`${id}-list`} role="listbox" className="flex flex-col rounded-lg border border-border/60 text-sm">
        {matches.length === 0 ? <li className="px-3 py-1.5 text-xs text-muted-foreground">Katılımcılarda yok</li> : null}
        {matches.map((team, index) => (
          <li
            key={team.id}
            id={`${id}-${team.id}`}
            role="option"
            aria-selected={index === active}
            aria-disabled={team.disabled}
            onMouseDown={(event) => {
              event.preventDefault();
              pick(index, event.shiftKey);
            }}
            className={cn("flex cursor-pointer items-center justify-between gap-2 px-3 py-1", index === active && "bg-white/[0.06]", team.disabled && "cursor-default opacity-40")}
          >
            <span className="truncate">{team.name}</span>
            <span className="shrink-0 text-[11px] text-muted-foreground">{team.meta}</span>
          </li>
        ))}
      </ul>
    </div>
  );
});
