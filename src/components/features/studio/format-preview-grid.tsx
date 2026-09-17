import { ImageIcon } from "lucide-react";
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
}

export function FormatPreviewGrid({ tournament }: FormatPreviewGridProps) {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
      {FORMATS.map((format) => (
        <FormatPlaceholderCard
          key={format.key}
          format={format}
          tournament={tournament}
        />
      ))}
    </div>
  );
}

function FormatPlaceholderCard({
  format,
  tournament,
}: {
  format: FormatSpec;
  tournament: TournamentTheme;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div
        style={{
          borderColor: hexToRgba(tournament.primary, 0.3),
          background: `linear-gradient(160deg, ${hexToRgba(tournament.primary, 0.08)}, rgba(255,255,255,0.015))`,
        }}
        className={`relative flex w-full items-center justify-center overflow-hidden rounded-xl border border-dashed ${format.aspectClass}`}
      >
        <div
          style={{
            borderColor: hexToRgba(tournament.primary, 0.4),
            color: tournament.secondary,
          }}
          className="absolute left-3 top-3 rounded-full border bg-black/60 px-2.5 py-1 text-[10px] font-medium tracking-wide"
        >
          {format.ratioLabel}
        </div>
        <div className="flex flex-col items-center gap-2 px-4 text-center">
          <ImageIcon className="size-7 text-white/20" />
          <p className="text-xs font-medium text-white/40">
            Önizleme burada görünecek
          </p>
        </div>
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
