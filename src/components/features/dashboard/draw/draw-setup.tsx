"use client";

import { useState, useTransition } from "react";
import { Download, Plus, X } from "lucide-react";
import { loadParticipantsAction } from "@/app/dashboard/studio/draw/actions";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { emptyDraw } from "@/lib/draw/entry";
import { DRAW_COMPETITIONS, DRAW_ROUNDS, drawCompetition, drawRound, seasonText } from "@/lib/draw/rounds";
import { cn } from "@/lib/utils";
import type { DrawState } from "@/types/draw";

/**
 * Kura öncesi hazırlık: turnuva + tur + sezon + kura tarihi; katılımcılar API'den. Birden çok kura (ŞL/AL/KL)
 * sekme olarak tutulur — Temsilcilerimiz kartı aynı sezonun bütün kuralarını birleştirir. Eşleşme girildikten
 * sonra turnuva/tur kilitlenir (kura tarihi değişebilir).
 */

export interface DrawSession {
  roundId: string;
  state: DrawState;
}

export function newSession(competitionId: number, season: number, roundId: string): DrawSession {
  const competition = drawCompetition(competitionId) ?? DRAW_COMPETITIONS[0];
  const round = drawRound(roundId) ?? DRAW_ROUNDS[3]!;
  return { roundId: round.id, state: emptyDraw({ competition: { id: competition.id, name: competition.name }, season, roundLabel: round.label, stage: round.stage, drawDateUtc: null }) };
}

const hasEntries = (state: DrawState) => state.ties.length > 0 || state.fixtures.length > 0;

interface DrawSetupProps {
  sessions: DrawSession[];
  active: number;
  onActive: (index: number) => void;
  onSessions: (sessions: DrawSession[]) => void;
}

export function DrawSetup({ sessions, active, onActive, onSessions }: DrawSetupProps) {
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, startLoading] = useTransition();
  const session = sessions[active]!;
  const { state } = session;
  const locked = hasEntries(state);
  const replace = (next: DrawSession) => onSessions(sessions.map((s, i) => (i === active ? next : s)));
  const reset = (competitionId: number, season: number, roundId: string) => {
    const next = newSession(competitionId, season, roundId);
    // Aynı turnuva + sezon: katılımcılar ve torbalar korunur.
    const keep = competitionId === state.competition.id && season === state.season;
    replace({ ...next, state: { ...next.state, drawDateUtc: state.drawDateUtc, teams: keep ? state.teams : [], nameOverrides: keep ? state.nameOverrides : {} } });
  };

  function load() {
    startLoading(async () => {
      const result = await loadParticipantsAction(state.competition.id, state.season);
      if (!result.ok) return setMessage(result.error.message);
      const known = new Map(state.teams.map((team) => [team.id, team]));
      const teams = [...state.teams, ...result.data.filter((team) => !known.has(team.id))];
      replace({ ...session, state: { ...state, teams } });
      setMessage(result.data.length ? `${result.data.length} takım API'den geldi (torbaları elle girin).` : "API bu turnuva/sezon için takım vermedi — elle ekleyin.");
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {sessions.map((s, index) => (
          <span key={`${s.state.competition.id}-${s.roundId}-${index}`} className={cn("flex items-center gap-1 rounded-lg border px-2.5 py-1 text-sm", index === active ? "border-emerald-500/60 bg-emerald-500/10" : "border-border")}>
            <button type="button" onClick={() => onActive(index)}>
              {drawCompetition(s.state.competition.id)?.short ?? s.state.competition.name} · {s.state.roundLabel}
            </button>
            {sessions.length > 1 ? (
              <button type="button" aria-label="Kurayı kaldır" onClick={() => onSessions(sessions.filter((_, i) => i !== index))} className="text-muted-foreground hover:text-red-400">
                <X className="size-3.5" />
              </button>
            ) : null}
          </span>
        ))}
        {sessions.length < 3 ? (
          <Button type="button" size="sm" variant="ghost" onClick={() => onSessions([...sessions, newSession(DRAW_COMPETITIONS.find((c) => !sessions.some((s) => s.state.competition.id === c.id))?.id ?? 2, state.season, session.roundId)])}>
            <Plus />
            Kura ekle
          </Button>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <label className="flex flex-col gap-1.5 text-xs font-medium text-muted-foreground">
          Turnuva
          <NativeSelect disabled={locked} value={state.competition.id} onChange={(event) => reset(Number(event.target.value), state.season, session.roundId)}>
            {DRAW_COMPETITIONS.map((competition) => (
              <option key={competition.id} value={competition.id}>
                {competition.name}
              </option>
            ))}
          </NativeSelect>
        </label>
        <label className="flex flex-col gap-1.5 text-xs font-medium text-muted-foreground">
          Tur
          <NativeSelect disabled={locked} value={session.roundId} onChange={(event) => reset(state.competition.id, state.season, event.target.value)}>
            {DRAW_ROUNDS.map((round) => (
              <option key={round.id} value={round.id}>
                {round.label}
              </option>
            ))}
          </NativeSelect>
        </label>
        <label className="flex flex-col gap-1.5 text-xs font-medium text-muted-foreground">
          Sezon
          <NativeSelect disabled={locked} value={state.season} onChange={(event) => reset(state.competition.id, Number(event.target.value), session.roundId)}>
            {[state.season - 1, state.season, state.season + 1].map((season) => (
              <option key={season} value={season}>
                {seasonText(season)}
              </option>
            ))}
          </NativeSelect>
        </label>
        <label className="flex flex-col gap-1.5 text-xs font-medium text-muted-foreground">
          Kura tarihi (künye)
          <input
            type="date"
            value={state.drawDateUtc?.slice(0, 10) ?? ""}
            onChange={(event) => replace({ ...session, state: { ...state, drawDateUtc: event.target.value ? new Date(`${event.target.value}T12:00:00Z`).toISOString() : null } })}
            className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm dark:bg-input/30 dark:[color-scheme:dark]"
          />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" size="sm" variant="outline" onClick={load} disabled={isLoading}>
          <Download />
          Katılımcıları API&apos;den yükle
        </Button>
        <span className="text-xs text-muted-foreground">{message ?? `${state.teams.length} katılımcı`}</span>
      </div>
    </div>
  );
}
