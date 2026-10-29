"use client";

import { useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import { NativeSelect } from "@/components/ui/native-select";
import { addLeagueFixture, addTie, drawTeamName, leagueOpponentLimit, opponentsOf, removeLeagueFixture, removeTie } from "@/lib/draw/entry";
import type { DrawState } from "@/types/draw";
import { TeamQuickPick, type QuickPickTeam } from "./team-quick-pick";

/**
 * Kura sırasında eşleşme girişi (klavyeyle): eleme → ev sahibi yaz + Enter, rakip yaz + Enter (eşleşme
 * eklenir, odak başa döner). Lig aşaması → takım seç; rakip yaz + Enter = iç saha, Shift+Enter = deplasman.
 * Tarihler isteğe bağlı (satırda). Kurallar `lib/draw/entry.ts`'te; hata satırın altında.
 */

interface DrawEntryProps {
  state: DrawState;
  onChange: (state: DrawState) => void;
  /** Lig aşamasında rakipleri girilen takım (A'nın odak takımıyla ortak). */
  leagueTeamId: number | null;
  onLeagueTeam: (teamId: number) => void;
}

const dateValue = (iso: string | null) => (iso ? iso.slice(0, 10) : "");
const toIso = (value: string) => (value ? new Date(`${value}T18:00:00Z`).toISOString() : null);

export function DrawEntry({ state, onChange, leagueTeamId, onLeagueTeam }: DrawEntryProps) {
  const [error, setError] = useState<string | null>(null);
  const [pendingFirst, setPendingFirst] = useState<number | null>(null);
  const firstRef = useRef<HTMLInputElement>(null);
  const secondRef = useRef<HTMLInputElement>(null);
  const name = (id: number) => drawTeamName(state, id);

  const used = useMemo(() => new Set(state.ties.flatMap((tie) => [tie.first, tie.second])), [state.ties]);
  const own = leagueTeamId ? opponentsOf(state, leagueTeamId) : [];
  const teams = (disabled: (id: number) => boolean): QuickPickTeam[] =>
    [...state.teams]
      .sort((a, b) => (a.pot ?? 9) - (b.pot ?? 9) || name(a.id).localeCompare(name(b.id), "tr-TR"))
      .map((team) => ({ id: team.id, name: name(team.id), meta: [team.pot ? `${team.pot}. torba` : null, team.country].filter(Boolean).join(" · "), disabled: disabled(team.id) }));

  function apply(result: ReturnType<typeof addTie>) {
    if (!result.ok) return setError(result.error);
    setError(null);
    onChange(result.state);
  }

  if (state.teams.length === 0) return <p className="text-sm text-muted-foreground">Önce katılımcıları yükleyin ya da ekleyin.</p>;

  if (state.stage === "KNOCKOUT") {
    return (
      <div className="flex flex-col gap-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <TeamQuickPick
            ref={firstRef}
            id="draw-first"
            label="İlk maçın ev sahibi"
            selectedName={pendingFirst ? name(pendingFirst) : null}
            teams={teams((id) => used.has(id))}
            onPick={(id) => {
              setPendingFirst(id);
              setError(null);
              secondRef.current?.focus();
            }}
          />
          <TeamQuickPick
            ref={secondRef}
            id="draw-second"
            label="Rakip"
            teams={teams((id) => used.has(id) || id === pendingFirst)}
            onPick={(id) => {
              if (!pendingFirst) return setError("Önce ilk maçın ev sahibini seçin.");
              apply(addTie(state, { first: pendingFirst, second: id, firstLegUtc: null, secondLegUtc: null }));
              setPendingFirst(null);
              firstRef.current?.focus();
            }}
          />
        </div>
        {error ? <p className="text-sm text-red-400">{error}</p> : null}
        <ol className="flex flex-col divide-y divide-border/60 rounded-lg border border-border/60 text-sm">
          {state.ties.length === 0 ? <li className="px-3 py-2 text-muted-foreground">Henüz eşleşme yok — kart girilenlerle üretilir.</li> : null}
          {state.ties.map((tie, index) => (
            <li key={`${tie.first}-${tie.second}`} className="flex flex-wrap items-center gap-2 px-3 py-1.5">
              <span className="w-6 text-xs text-muted-foreground">{index + 1}</span>
              <span className="min-w-0 flex-1 truncate">
                {name(tie.first)} – {name(tie.second)}
              </span>
              {(["firstLegUtc", "secondLegUtc"] as const).map((leg, legIndex) => (
                <input
                  autoComplete="off"
                  key={leg}
                  type="date"
                  aria-label={`${legIndex + 1}. maç tarihi`}
                  value={dateValue(tie[leg])}
                  onChange={(event) => onChange({ ...state, ties: state.ties.map((t, i) => (i === index ? { ...t, [leg]: toIso(event.target.value) } : t)) })}
                  className="h-7 rounded-md border border-input bg-transparent px-1.5 text-xs dark:[color-scheme:dark]"
                />
              ))}
              <button type="button" aria-label="Eşleşmeyi sil" onClick={() => onChange(removeTie(state, index))} className="text-muted-foreground hover:text-red-400">
                <X className="size-4" />
              </button>
            </li>
          ))}
        </ol>
      </div>
    );
  }

  const limit = leagueOpponentLimit(state.competition.id);
  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1.5 text-xs font-medium text-muted-foreground">
        Rakipleri girilen takım
        <NativeSelect value={leagueTeamId ?? ""} onChange={(event) => onLeagueTeam(Number(event.target.value))}>
          <option value="" disabled>
            Takım seçin
          </option>
          {teams(() => false)
            .sort((a, b) => Number(state.teams.find((t) => t.id === b.id)?.country === "Turkey") - Number(state.teams.find((t) => t.id === a.id)?.country === "Turkey"))
            .map((team) => (
              <option key={team.id} value={team.id}>
                {team.name} ({opponentsOf(state, team.id).length}/{limit})
              </option>
            ))}
        </NativeSelect>
      </label>
      {leagueTeamId ? (
        <TeamQuickPick
          id="draw-opponent"
          label={`Rakip — Enter: iç saha · Shift+Enter: deplasman (${own.length}/${limit})`}
          teams={teams((id) => id === leagueTeamId || own.some((f) => f.opponentId === id))}
          onPick={(id, alt) => apply(addLeagueFixture(state, { teamId: leagueTeamId, opponentId: id, venue: alt ? "AWAY" : "HOME", dateUtc: null }))}
        />
      ) : null}
      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      {leagueTeamId ? (
        <ol className="flex flex-col divide-y divide-border/60 rounded-lg border border-border/60 text-sm">
          {own.length === 0 ? <li className="px-3 py-2 text-muted-foreground">Henüz rakip yok — kart girilenlerle üretilir.</li> : null}
          {own.map((fixture, index) => (
            <li key={fixture.opponentId} className="flex flex-wrap items-center gap-2 px-3 py-1.5">
              <span className="w-6 text-xs text-muted-foreground">{index + 1}</span>
              <span className="min-w-0 flex-1 truncate">{name(fixture.opponentId)}</span>
              <button
                type="button"
                onClick={() => onChange({ ...state, fixtures: state.fixtures.map((f) => (f === fixture ? { ...f, venue: f.venue === "HOME" ? "AWAY" : "HOME" } : f)) })}
                className="rounded-md border border-border px-2 py-0.5 text-xs"
              >
                {fixture.venue === "HOME" ? "İç saha" : "Deplasman"}
              </button>
              <input
                autoComplete="off"
                type="date"
                aria-label="Maç tarihi"
                value={dateValue(fixture.dateUtc)}
                onChange={(event) => onChange({ ...state, fixtures: state.fixtures.map((f) => (f === fixture ? { ...f, dateUtc: toIso(event.target.value) } : f)) })}
                className="h-7 rounded-md border border-input bg-transparent px-1.5 text-xs dark:[color-scheme:dark]"
              />
              <button type="button" aria-label="Rakibi sil" onClick={() => onChange(removeLeagueFixture(state, fixture.teamId, fixture.opponentId))} className="text-muted-foreground hover:text-red-400">
                <X className="size-4" />
              </button>
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}
