"use client";

import { useState } from "react";
import { AlertCircle, Sparkles, Wand2 } from "lucide-react";
import { generateMatchDayAction } from "@/app/dashboard/studio/match-day/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { useActionForm } from "@/hooks/use-action-form";
import { RANDOM_TEMPLATE } from "@/lib/dashboard/match-day-templates";
import type { MatchDayActionState, MatchDayFixtureOption, MatchDayFormatId } from "@/types/match-day";
import type { MediaAssetOption } from "@/types/media";
import { LibraryImageField } from "./library-image-field";
import { MatchDayAiSettings } from "./match-day-ai-settings";
import { MatchDayFormatPicker } from "./match-day-format-picker";
import { MatchDayPreview } from "./match-day-preview";
import { MatchDayTemplatePicker } from "./match-day-template-picker";
import { EMPTY_MATCH_DAY_INFO, MatchDayInfoFields, type MatchDayInfoValues } from "./match-day-info-fields";

interface MatchDayFormProps {
  fixtures: MatchDayFixtureOption[];
  /** Medya kütüphanesindeki oyuncu fotoğrafları (bkz. CLAUDE.md 1.11). */
  playerOptions: MediaAssetOption[];
  disabled?: boolean;
}

const INITIAL_STATE: MatchDayActionState = {};

const DERBY_OPTIONS = [
  { value: "NONE", label: "Normal maç" },
  { value: "RIVALRY", label: "Rekabet" },
  { value: "DERBY", label: "Derbi" },
  { value: "ELITE_DERBY", label: "Büyük derbi" },
] as const;

function toInfo(fixture: MatchDayFixtureOption): MatchDayInfoValues {
  return {
    homeTeam: fixture.homeTeam,
    awayTeam: fixture.awayTeam,
    homeLogo: fixture.homeLogoUrl,
    awayLogo: fixture.awayLogoUrl,
    leagueLogo: fixture.leagueLogoUrl,
    league: fixture.league,
    week: fixture.week,
    date: fixture.date,
    time: fixture.time,
    stadium: fixture.stadium,
    referee: fixture.referee,
  };
}

export function MatchDayForm({ fixtures, playerOptions, disabled = false }: MatchDayFormProps) {
  const { state, isPending, onSubmit } = useActionForm(generateMatchDayAction, INITIAL_STATE);
  const [fixtureId, setFixtureId] = useState("");
  const [info, setInfo] = useState<MatchDayInfoValues>(EMPTY_MATCH_DAY_INFO);
  const [template, setTemplate] = useState<string>(RANDOM_TEMPLATE);
  const [format, setFormat] = useState<MatchDayFormatId>("IG_PORTRAIT");

  function selectFixture(id: string) {
    setFixtureId(id);
    const fixture = fixtures.find((option) => option.id === id);
    setInfo(fixture ? toInfo(fixture) : EMPTY_MATCH_DAY_INFO);
  }

  return (
    <div className="grid gap-6 xl:grid-cols-5">
      <Card className="xl:col-span-3">
        <CardHeader>
          <CardTitle>Maç Günü Kartı Üretici</CardTitle>
          <CardDescription>
            Maçı seçin — takımlar, logolar, stadyum, saat, lig ve hafta otomatik dolar. İki oyuncu fotoğrafını ekleyin;
            platformu ve şablonu seçin. Oyuncular kesilip gerçekçi bir sahneye yerleştirilir; yazılar en son programatik basılır.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="flex flex-col gap-5">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="match-day-fixture">Maç (API-Football · önümüzdeki 7 gün)</Label>
              <NativeSelect
                id="match-day-fixture"
                name="fixtureId"
                value={fixtureId}
                onChange={(event) => selectFixture(event.target.value)}
              >
                <option value="">{fixtures.length ? "Maç seçin… (veya alanları elle doldurun)" : "Maç bulunamadı — alanları elle doldurun"}</option>
                {fixtures.map((fixture) => (
                  <option key={fixture.id} value={fixture.id}>
                    {fixture.label}
                  </option>
                ))}
              </NativeSelect>
            </div>

            <MatchDayInfoFields values={info} onChange={setInfo} />

            <MatchDayFormatPicker value={format} onChange={setFormat} />

            <MatchDayTemplatePicker value={template} onChange={setTemplate} />

            <div className="grid gap-4 sm:grid-cols-2">
              <LibraryImageField
                name="homePlayer"
                label={`${info.homeTeam || "Ev sahibi"} oyuncusu (sol)`}
                hint="JPEG/PNG/WebP · küçükse AI ile büyütülür"
                options={playerOptions}
              />
              <LibraryImageField
                name="awayPlayer"
                label={`${info.awayTeam || "Deplasman"} oyuncusu (sağ)`}
                hint="JPEG/PNG/WebP · küçükse AI ile büyütülür"
                options={playerOptions}
              />
              <p className="flex items-start gap-2 rounded-lg border border-sky-500/25 bg-sky-500/[0.07] px-3 py-2 text-xs text-sky-200 sm:col-span-2">
                <Wand2 className="mt-0.5 size-3.5 shrink-0 text-sky-300" />
                <span>
                  Küçük fotoğraflar yapay zeka (AI Upscale) ile otomatik olarak netleştirilir ve büyütülür.
                  <span className="block text-[11px] text-sky-200/60">
                    1024px altındaki görseller arka plan silinmeden önce Real-ESRGAN ile 4 kata kadar büyütülür.
                  </span>
                </span>
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="homeColorHex">Ev sahibi rengi</Label>
                <Input id="homeColorHex" name="homeColorHex" type="color" defaultValue="#e11d48" className="h-9 p-1" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="awayColorHex">Deplasman rengi</Label>
                <Input id="awayColorHex" name="awayColorHex" type="color" defaultValue="#1d4ed8" className="h-9 p-1" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="derbyIntensity">Maç tansiyonu</Label>
                <NativeSelect id="derbyIntensity" name="derbyIntensity" required defaultValue="">
                  <option value="" disabled>
                    Seçin…
                  </option>
                  {DERBY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </NativeSelect>
              </div>
            </div>

            <MatchDayAiSettings template={template} />

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="match-day-prompt">Ek yönerge (isteğe bağlı)</Label>
              <Textarea
                id="match-day-prompt"
                name="customPrompt"
                rows={2}
                maxLength={500}
                placeholder="Örn: yağmurlu akşam, ıslak çim, stadyum ışıkları…"
              />
            </div>

            {state.error ? (
              <p className="flex items-center gap-1.5 text-xs text-destructive" role="alert">
                <AlertCircle className="size-3.5 shrink-0" />
                {state.error}
              </p>
            ) : null}

            <Button type="submit" size="lg" disabled={disabled || isPending}>
              <Sparkles />
              {isPending ? "Üretiliyor…" : "Kartı Üret"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="xl:col-span-2">
        <MatchDayPreview result={state.result} isPending={isPending} format={format} />
      </div>
    </div>
  );
}
