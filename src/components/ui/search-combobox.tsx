"use client";

import * as React from "react";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { matchesQuery } from "@/lib/text-fold";
import { cn } from "@/lib/utils";

/**
 * Aramalı birleşik kutu (combobox) — gruplu seçenekler, yazınca süzme (Türkçe karakter duyarsız:
 * "kokcu" → "Orkun Kökçü"), klavyeyle gezinme (↑/↓, Enter, Escape, Home/End). WAI-ARIA combobox
 * deseni: giriş `role="combobox"`, liste `role="listbox"`, etkin seçenek `aria-activedescendant`.
 */

export interface ComboboxItem {
  value: string;
  label: string;
  /** Sağda soluk gösterilen ek bilgi (ör. fotoğraf sayısı). */
  meta?: string;
  /** Aramaya ek sözcükler (ör. takım adı). */
  keywords?: string;
}

export interface ComboboxGroup {
  label: string;
  items: ComboboxItem[];
}

interface SearchComboboxProps {
  id: string;
  groups: ComboboxGroup[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  emptyText?: string;
  disabled?: boolean;
  className?: string;
}

export function SearchCombobox({ id, groups, value, onChange, placeholder = "Ara…", emptyText = "Sonuç yok", disabled = false, className }: SearchComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [active, setActive] = React.useState(0);
  const listRef = React.useRef<HTMLUListElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listId = `${id}-list`;

  const selected = React.useMemo(() => groups.flatMap((group) => group.items).find((item) => item.value === value) ?? null, [groups, value]);
  const filtered = React.useMemo(
    () => groups.map((group) => ({ ...group, items: group.items.filter((item) => !query || matchesQuery(`${item.label} ${item.keywords ?? ""} ${group.label}`, query)) })).filter((group) => group.items.length > 0),
    [groups, query],
  );
  const flat = React.useMemo(() => filtered.flatMap((group) => group.items), [filtered]);
  /** Her grubun ilk seçeneğinin düz listedeki sırası (aria-activedescendant kimlikleri için). */
  const groupStarts = React.useMemo(() => filtered.map((_, groupIndex) => filtered.slice(0, groupIndex).reduce((sum, group) => sum + group.items.length, 0)), [filtered]);
  const optionId = (index: number) => `${id}-option-${index}`;

  function openList() {
    if (disabled) return;
    setOpen(true);
    setActive(Math.max(0, flat.findIndex((item) => item.value === value)));
  }

  function choose(item: ComboboxItem) {
    onChange(item.value);
    setQuery("");
    setOpen(false);
    inputRef.current?.blur();
  }

  // Etkin seçenek görünür kalsın (klavyeyle gezinirken).
  React.useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector(`#${CSS.escape(optionId(active))}`)?.scrollIntoView({ block: "nearest" });
    // optionId yalnızca id'ye bağlı.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, open]);

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) return openList();
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActive((current) => (flat.length === 0 ? 0 : (current + step + flat.length) % flat.length));
    } else if (event.key === "Home" && open) {
      event.preventDefault();
      setActive(0);
    } else if (event.key === "End" && open) {
      event.preventDefault();
      setActive(Math.max(0, flat.length - 1));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const item = flat[active];
      if (open && item) choose(item);
      else openList();
    } else if (event.key === "Escape") {
      setQuery("");
      setOpen(false);
    }
  }

  return (
    <div className={cn("relative", className)}>
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          ref={inputRef}
          id={id}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && flat[active] ? optionId(active) : undefined}
          autoComplete="off"
          disabled={disabled}
          value={open ? query : (selected?.label ?? "")}
          placeholder={selected?.label ?? placeholder}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
            setOpen(true);
          }}
          onFocus={openList}
          onClick={openList}
          onBlur={() => setOpen(false)}
          onKeyDown={onKeyDown}
          className="h-8 w-full rounded-lg border border-input bg-transparent pl-8 pr-8 text-xs text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30"
        />
        <ChevronsUpDown className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
      </div>
      {open ? (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          // Tıklamada giriş odağını kaybetmesin (onBlur listeyi kapatmadan seçim yapılabilsin).
          onMouseDown={(event) => event.preventDefault()}
          className="absolute z-50 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-border bg-popover py-1 text-xs text-popover-foreground shadow-lg"
        >
          {flat.length === 0 ? <li className="px-3 py-2 text-muted-foreground">{emptyText}</li> : null}
          {filtered.map((group, groupIndex) => (
            <li key={group.label} role="presentation">
              <div className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{group.label}</div>
              <ul role="group" aria-label={group.label}>
                {group.items.map((item, position) => {
                  const itemIndex = (groupStarts[groupIndex] ?? 0) + position;
                  const isActive = itemIndex === active;
                  return (
                    <li
                      key={item.value}
                      id={optionId(itemIndex)}
                      role="option"
                      aria-selected={item.value === value}
                      onMouseEnter={() => setActive(itemIndex)}
                      onClick={() => choose(item)}
                      className={cn("flex cursor-pointer items-center gap-2 px-3 py-1.5", isActive && "bg-accent text-accent-foreground")}
                    >
                      <Check className={cn("size-3.5 shrink-0", item.value === value ? "opacity-100" : "opacity-0")} />
                      <span className="min-w-0 flex-1 truncate">{item.label}</span>
                      {item.meta ? <span className="shrink-0 text-[10px] text-muted-foreground">{item.meta}</span> : null}
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
