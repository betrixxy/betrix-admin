"use client";

import { ArrowDown, ArrowUp, Plus, Scissors, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { matchCenter, shortDate, weeklyGrouping } from "@/lib/dashboard/weekly-fixtures-layout";
import { cn } from "@/lib/utils";
import type { WeeklyMatch } from "@/types/weekly-fixtures";

interface WeeklyMatchEditorProps {
  /** Turun tüm maçları (başlama saatine göre). */
  matches: WeeklyMatch[];
  /** Karttaki maçlar, sırasıyla. */
  selected: string[];
  onChange: (selected: string[]) => void;
  /** Kart sığmıyor/üst sınır aşıldıysa bölme kısayolları gösterilir. */
  overflow: boolean;
}

function centerLabel(match: WeeklyMatch): string {
  const center = matchCenter(match, "date");
  return center.kind === "score" ? center.primary : `${shortDate(match.dateKey)} ${center.primary}`;
}

function MatchLine({ match, children, muted }: { match: WeeklyMatch; children: React.ReactNode; muted?: boolean }) {
  return (
    <li className={cn("flex items-center gap-2 rounded-md border border-border/60 px-2.5 py-1.5 text-sm", muted && "opacity-60")}>
      <span className="w-[5.5rem] shrink-0 font-mono text-xs text-muted-foreground">{centerLabel(match)}</span>
      <span className="min-w-0 flex-1 truncate">
        {match.home.name} <span className="text-muted-foreground">–</span> {match.away.name}
      </span>
      {match.group ? <span className="shrink-0 rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-medium">{match.group} Grubu</span> : null}
      <span className="flex shrink-0 gap-1">{children}</span>
    </li>
  );
}

/** Kartın maç listesi: sırala, çıkar, geri ekle; kalabalık turda kartı ikiye bölme kısayolu. */
export function WeeklyMatchEditor({ matches, selected, onChange, overflow }: WeeklyMatchEditorProps) {
  const byId = new Map(matches.map((match) => [match.id, match]));
  const chosen = selected.map((id) => byId.get(id)).filter((match) => match !== undefined);
  const removed = matches.filter((match) => !selected.includes(match.id));
  const half = Math.ceil(matches.length / 2);

  const move = (index: number, delta: number) => {
    const next = [...selected];
    const [item] = next.splice(index, 1);
    if (item) next.splice(index + delta, 0, item);
    onChange(next);
  };

  return (
    <div className="flex flex-col gap-3">
      {overflow ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" variant="outline" onClick={() => onChange(matches.slice(0, half).map((match) => match.id))}>
            <Scissors />
            1. kart: ilk {half} maç
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => onChange(matches.slice(half).map((match) => match.id))}>
            <Scissors />
            2. kart: son {matches.length - half} maç
          </Button>
        </div>
      ) : null}

      <ol className="flex flex-col gap-1.5">
        {chosen.map((match, index) => (
          <MatchLine key={match.id} match={match}>
            <Button type="button" size="icon-xs" variant="ghost" disabled={index === 0} onClick={() => move(index, -1)} title="Yukarı taşı">
              <ArrowUp />
            </Button>
            <Button type="button" size="icon-xs" variant="ghost" disabled={index === chosen.length - 1} onClick={() => move(index, 1)} title="Aşağı taşı">
              <ArrowDown />
            </Button>
            <Button type="button" size="icon-xs" variant="ghost" onClick={() => onChange(selected.filter((id) => id !== match.id))} title="Karttan çıkar">
              <X />
            </Button>
          </MatchLine>
        ))}
      </ol>
      {chosen.length === 0 ? <p className="text-xs text-muted-foreground">Kartta maç yok — aşağıdan ekleyin.</p> : null}

      {removed.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-medium text-muted-foreground">Kartta olmayan maçlar ({removed.length})</p>
          <ul className="flex flex-col gap-1.5">
            {removed.map((match) => (
              <MatchLine key={match.id} match={match} muted>
                <Button type="button" size="icon-xs" variant="ghost" onClick={() => onChange([...selected, match.id])} title="Karta ekle">
                  <Plus />
                </Button>
              </MatchLine>
            ))}
          </ul>
        </div>
      ) : null}
      {weeklyGrouping(chosen) === "group" ? <p className="text-[11px] text-muted-foreground">Grup aşaması: kart gruplara (A, B, C…) bölünür.</p> : null}
    </div>
  );
}
