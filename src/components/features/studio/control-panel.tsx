"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { hexToRgba } from "@/lib/studio/color";
import { getTemplate } from "@/lib/studio/templates";
import type { TemplateId, TournamentTheme } from "@/types/studio";
import { generateMatchCardAction } from "@/app/studio/actions";
import { CommonMatchFields } from "@/components/features/studio/forms/common-match-fields";
import { MatchDayForm } from "@/components/features/studio/forms/match-day-form";
import { AiPredictionForm } from "@/components/features/studio/forms/ai-prediction-form";
import { TeamAnalysisForm } from "@/components/features/studio/forms/team-analysis-form";
import { LineupForm } from "@/components/features/studio/forms/lineup-form";

interface ControlPanelProps {
  template: TemplateId;
  tournament: TournamentTheme;
}

export function ControlPanel({ template, tournament }: ControlPanelProps) {
  const [isPending, startTransition] = useTransition();
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  const templateDef = getTemplate(template);

  function handleGenerate() {
    setResultMessage(null);
    startTransition(async () => {
      const result = await generateMatchCardAction({
        templateId: template,
        tournamentId: tournament.id,
      });
      setResultMessage(result.message);
    });
  }

  return (
    <Card className="border-border bg-card/60 py-0 backdrop-blur">
      <CardHeader className="border-b border-border py-5">
        <CardTitle className="text-base text-white">
          {templateDef.label}
        </CardTitle>
        <CardDescription>{templateDef.description}</CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-6 py-6">
        <section className="flex flex-col gap-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Maç
          </h3>
          <CommonMatchFields />
        </section>

        <Separator />

        <section>
          {template === "match-day" && <MatchDayForm />}
          {template === "ai-prediction" && <AiPredictionForm />}
          {template === "team-analysis" && <TeamAnalysisForm />}
          {template === "lineup" && <LineupForm />}
        </section>
      </CardContent>

      <CardFooter className="flex flex-col gap-3 border-t border-border py-5">
        <Button
          size="lg"
          disabled={isPending}
          onClick={handleGenerate}
          style={{
            background: `linear-gradient(90deg, ${tournament.primary}, ${hexToRgba(tournament.secondary, 0.9)}, ${tournament.primary})`,
            boxShadow: `0 0 30px -8px ${hexToRgba(tournament.primary, 0.7)}`,
          }}
          className="w-full font-semibold text-white shadow-lg transition-shadow hover:brightness-110 disabled:opacity-70"
        >
          {isPending ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Üretiliyor...
            </>
          ) : (
            <>
              <Sparkles className="size-4" />
              Yapay Zeka ile Maç Kartlarını Üret
            </>
          )}
        </Button>

        {resultMessage && (
          <p
            role="status"
            className="flex items-center gap-1.5 text-xs font-medium text-emerald-400"
          >
            <CheckCircle2 className="size-3.5" />
            {resultMessage}
          </p>
        )}
      </CardFooter>
    </Card>
  );
}
