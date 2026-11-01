"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { SelectMatchButton } from "@/components/features/dashboard/reels-action-buttons";
import { Input } from "@/components/ui/input";
import { filterReelDays, type ReelListDay, type ReelListRow, type ReelListTeam } from "@/lib/reels/match-list";
import type { PublishWindowPhase } from "@/lib/reels/publish-window";
import { cn } from "@/lib/utils";

const PHASE_TONE: Record<PublishWindowPhase, string> = {
  BEFORE: "text-muted-foreground",
  OPEN: "text-emerald-300",
  CLOSED: "text-amber-300",
};

function TeamName({ team }: { team: ReelListTeam }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      {team.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={team.logoUrl} alt="" width={20} height={20} className="size-5 shrink-0 object-contain" loading="lazy" />
      ) : null}
      <span className="truncate">{team.name}</span>
    </span>
  );
}

function MatchRow({ row, hidden }: { row: ReelListRow; hidden: boolean }) {
  return (
    <li hidden={hidden} className="grid grid-cols-1 items-center gap-2 border-b border-border/60 py-3 text-sm last:border-0 md:grid-cols-[7rem_minmax(0,1fr)_13rem_auto]">
      <div className="text-muted-foreground">
        <div className="font-medium text-white">{row.time}</div>
        <div className="text-xs">{row.league}</div>
      </div>
      <div className="flex min-w-0 flex-col gap-1">
        <TeamName team={row.home} />
        <TeamName team={row.away} />
      </div>
      <div className="text-xs text-muted-foreground">
        <div className={row.analysisAvailable ? "text-emerald-300" : "text-amber-300"}>{row.analysisAvailable ? "Analiz var" : "Analiz yok"}</div>
        <div>
          {row.deadline} · <span className={PHASE_TONE[row.phase]}>{row.phaseLabel}</span>
        </div>
      </div>
      <div className="justify-self-end">
        <SelectMatchButton matchId={row.matchId} selected={row.selected} />
      </div>
    </li>
  );
}

export function ReelsMatchBrowser({ days }: { days: ReelListDay[] }) {
  const [query, setQuery] = useState("");
  // Kullanıcının açıp kapattığı günler; dokunulmayan gün varsayılanını izler.
  const [toggled, setToggled] = useState<Record<string, boolean>>({});
  const visible = useMemo(() => filterReelDays(days, query), [days, query]);
  const searching = query.trim().length > 0;
  const shownKeys = new Set(visible.map((day) => day.key));
  const shownRows = new Map(visible.flatMap((day) => day.rows.map((row) => [row.matchId, true] as const)));

  return (
    <div className="flex flex-col gap-3">
      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Takım ara" aria-label="Takım ara" className="pl-8" />
      </div>
      {searching && visible.length === 0 ? <p className="text-sm text-muted-foreground">Bu adla maç bulunamadı.</p> : null}
      {/* Süzülen satırlar gizlenir, kaldırılmaz: seçim düğmesinin durumu ve hata mesajı kaybolmaz. */}
      {days.map((day) => {
        const open = searching || (toggled[day.key] ?? day.defaultOpen);
        const count = searching ? day.rows.filter((row) => shownRows.has(row.matchId)).length : day.rows.length;
        return (
          <section key={day.key} hidden={!shownKeys.has(day.key)} className="rounded-lg border border-border/60">
            <button
              type="button"
              aria-expanded={open}
              onClick={() => setToggled((current) => ({ ...current, [day.key]: !open }))}
              className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm font-medium text-white"
            >
              <span>{day.heading} <span className="font-normal text-muted-foreground">· {count} maç</span></span>
              <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
            </button>
            <ul hidden={!open} className="flex flex-col px-3">
              {day.rows.map((row) => (
                <MatchRow key={row.matchId} row={row} hidden={!shownRows.has(row.matchId)} />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
