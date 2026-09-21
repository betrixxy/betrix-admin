import { Check, ImageIcon, Loader2 } from "lucide-react";
import { hexToRgba } from "@/lib/studio/color";
import type { TournamentTheme } from "@/types/studio";

interface FormatSpec {
  key: string;
  platformLabel: string;
  dimensions: string;
  ratioLabel: string;
  aspectClass: string;
}

const FORMATS: FormatSpec[] = [
  {
    key: "ig-feed",
    platformLabel: "IG Feed",
    dimensions: "1080 x 1350",
    ratioLabel: "4:5",
    aspectClass: "aspect-[4/5]",
  },
  {
    key: "reels-story",
    platformLabel: "Reels / TikTok / Story",
    dimensions: "1080 x 1920",
    ratioLabel: "9:16",
    aspectClass: "aspect-[9/16]",
  },
  {
    key: "x-twitter",
    platformLabel: "X / Twitter",
    dimensions: "1200 x 675",
    ratioLabel: "16:9",
    aspectClass: "aspect-[16/9]",
  },
];

interface FormatPreviewGridProps {
  tournament: TournamentTheme;
  templateLabel: string;
  isPending: boolean;
  hasGenerated: boolean;
}

export function FormatPreviewGrid({
  tournament,
  templateLabel,
  isPending,
  hasGenerated,
}: FormatPreviewGridProps) {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
      {FORMATS.map((format) => (
        <FormatPlaceholderCard
          key={format.key}
          format={format}
          tournament={tournament}
          templateLabel={templateLabel}
          isPending={isPending}
          hasGenerated={hasGenerated}
        />
      ))}
    </div>
  );
}

function FormatPlaceholderCard({
  format,
  tournament,
  templateLabel,
  isPending,
  hasGenerated,
}: {
  format: FormatSpec;
  tournament: TournamentTheme;
  templateLabel: string;
  isPending: boolean;
  hasGenerated: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div
        style={
          hasGenerated
            ? {
                borderColor: hexToRgba(tournament.primary, 0.4),
                background: `radial-gradient(120% 120% at 15% 0%, ${hexToRgba(tournament.secondary, 0.35)}, transparent 55%), linear-gradient(155deg, ${hexToRgba(tournament.primary, 0.85)}, #05070d 75%)`,
              }
            : {
                borderColor: hexToRgba(tournament.primary, 0.3),
                background: `linear-gradient(160deg, ${hexToRgba(tournament.primary, 0.08)}, rgba(255,255,255,0.015))`,
              }
        }
        className={`relative flex w-full items-end overflow-hidden rounded-xl border ${hasGenerated ? "border-solid" : "border-dashed"} ${format.aspectClass}`}
      >
        <div
          style={{
            borderColor: hexToRgba(tournament.primary, 0.4),
            color: tournament.secondary,
          }}
          className="absolute left-3 top-3 z-10 rounded-full border bg-black/60 px-2.5 py-1 text-[10px] font-medium tracking-wide"
        >
          {format.ratioLabel}
        </div>

        {hasGenerated && (
          <div className="absolute right-3 top-3 z-10 flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/15 px-2 py-1 text-[10px] font-medium text-emerald-400">
            <Check className="size-3" />
            Üretildi
          </div>
        )}

        {isPending && (
          <div className="flex w-full flex-col items-center gap-2 px-4 py-10 text-center">
            <Loader2 className="size-7 animate-spin text-white/50" />
            <p className="text-xs font-medium text-white/50">Üretiliyor...</p>
          </div>
        )}

        {!isPending && !hasGenerated && (
          <div className="flex w-full flex-col items-center gap-2 px-4 py-10 text-center">
            <ImageIcon className="size-7 text-white/20" />
            <p className="text-xs font-medium text-white/40">
              Önizleme burada görünecek
            </p>
          </div>
        )}

        {!isPending && hasGenerated && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 mix-blend-screen"
            style={{
              background: `radial-gradient(60% 45% at 50% 15%, ${hexToRgba(tournament.secondary, 0.5)}, transparent 70%)`,
            }}
          />
        )}

        {!isPending && hasGenerated && (
          <div className="relative z-10 flex w-full flex-col gap-0.5 p-4">
            <span
              className="text-[10px] font-semibold uppercase tracking-wide"
              style={{ color: tournament.secondary }}
            >
              {tournament.label}
            </span>
            <span className="text-sm font-bold text-white">{templateLabel}</span>
            <span className="text-[10px] text-white/40">CheckMatch.net (mock önizleme)</span>
          </div>
        )}
      </div>
      <div className="flex items-baseline justify-between px-0.5">
        <span className="text-sm font-medium text-white/80">
          {format.platformLabel}
        </span>
        <span className="text-xs text-muted-foreground">
          {format.dimensions}
        </span>
      </div>
    </div>
  );
}
