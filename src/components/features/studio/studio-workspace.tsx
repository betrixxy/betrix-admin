"use client";

import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { hexToRgba } from "@/lib/studio/color";
import { getTemplate } from "@/lib/studio/templates";
import { getTournament } from "@/lib/studio/tournaments";
import type { TemplateId, TournamentId } from "@/types/studio";
import { generateMatchCardAction } from "@/app/studio/actions";
import { TemplateTabs } from "@/components/features/studio/template-tabs";
import { TournamentSelector } from "@/components/features/studio/tournament-selector";
import { ControlPanel } from "@/components/features/studio/control-panel";
import { FormatPreviewGrid } from "@/components/features/studio/format-preview-grid";

export function StudioWorkspace() {
  const [template, setTemplate] = useState<TemplateId>("match-day");
  const [tournamentId, setTournamentId] = useState<TournamentId>("ucl");
  const [isPending, startTransition] = useTransition();
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  const [hasGenerated, setHasGenerated] = useState(false);

  const tournament = getTournament(tournamentId);
  const templateDef = getTemplate(template);

  function handleTemplateChange(next: TemplateId) {
    setTemplate(next);
    setHasGenerated(false);
    setResultMessage(null);
  }

  function handleTournamentChange(next: TournamentId) {
    setTournamentId(next);
    setHasGenerated(false);
    setResultMessage(null);
  }

  function handleGenerate() {
    setResultMessage(null);
    startTransition(async () => {
      const result = await generateMatchCardAction({
        templateId: template,
        tournamentId: tournament.id,
      });
      setResultMessage(result.message);
      setHasGenerated(result.success);
    });
  }

  const statusLabel = isPending
    ? "üretiliyor..."
    : hasGenerated
      ? "üretildi"
      : "henüz üretilmedi";

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-xl border border-border bg-card/40">
        <TemplateTabs value={template} onChange={handleTemplateChange} />
        <div className="flex flex-col gap-2.5 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Turnuva / Lig
          </span>
          <TournamentSelector value={tournamentId} onChange={handleTournamentChange} />
        </div>
      </div>

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[420px_1fr]">
        <ControlPanel
          template={template}
          tournament={tournament}
          isPending={isPending}
          resultMessage={resultMessage}
          onGenerate={handleGenerate}
        />

        <section className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-card/40 px-4 py-3">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-white">
                Önizleme Alanı
              </h2>
              <Badge
                variant="outline"
                style={{
                  borderColor: hexToRgba(tournament.primary, 0.4),
                  color: tournament.secondary,
                  backgroundColor: hexToRgba(tournament.primary, 0.12),
                }}
              >
                {tournament.label}
              </Badge>
              <Badge variant="secondary">{templateDef.label}</Badge>
            </div>
            <span className="text-xs text-muted-foreground">
              3 format · {statusLabel}
            </span>
          </div>
          <FormatPreviewGrid
            tournament={tournament}
            templateLabel={templateDef.label}
            isPending={isPending}
            hasGenerated={hasGenerated}
          />
        </section>
      </div>
    </div>
  );
}
