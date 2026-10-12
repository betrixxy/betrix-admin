"use client";

import { AlertTriangle, LoaderCircle, Sparkles } from "lucide-react";
import { CopyTextButton } from "@/components/features/dashboard/copy-text-button";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { captionLength } from "@/lib/dashboard/publish-caption";
import { cn } from "@/lib/utils";
import { PUBLISH_PLATFORM_DEFS, type PublishPlatform } from "@/types/publishing";

interface CaptionEditorProps {
  platform: PublishPlatform;
  value: string;
  onChange: (value: string) => void;
  /** Canlı denetim uyarıları (sayı, sınır, hashtag). */
  warnings: string[];
  source: "ai" | "template";
  aiAvailable: boolean;
  isGenerating: boolean;
  onRegenerate: () => void;
  disabled?: boolean;
}

/** Platforma özel gönderi metni: düzenlenebilir alan, karakter sayacı, denetim uyarıları ve "AI ile yeniden yaz". */
export function CaptionEditor({ platform, value, onChange, warnings, source, aiAvailable, isGenerating, onRegenerate, disabled }: CaptionEditorProps) {
  const limit = PUBLISH_PLATFORM_DEFS[platform].captionLimit;
  const length = captionLength(value, platform);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor="publish-caption">
          Gönderi metni · {PUBLISH_PLATFORM_DEFS[platform].label}
          <span className="ml-2 rounded bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-normal text-muted-foreground">{source === "ai" ? "AI" : "Şablon"}</span>
        </Label>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!aiAvailable || isGenerating || disabled}
          onClick={onRegenerate}
          title={aiAvailable ? "Seçili platform için Claude ile yeniden yaz (ücretli)" : "ANTHROPIC_API_KEY tanımlı değil"}
        >
          {isGenerating ? <LoaderCircle className="animate-spin" /> : <Sparkles />}
          {isGenerating ? "Yazılıyor…" : "Yapay Zekayla Yeniden Yaz"}
        </Button>
      </div>
      <Textarea
        id="publish-caption"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={platform === "X" ? 5 : 11}
        disabled={disabled || isGenerating}
        className={cn("font-mono text-xs leading-relaxed", isGenerating && "opacity-60")}
      />
      <div className="flex items-center justify-between gap-2">
        <span className={cn("text-[11px] tabular-nums", length > limit ? "text-destructive" : "text-muted-foreground")}>
          {length} / {limit} karakter{platform === "X" ? " (emoji 2 sayılır)" : ""}
        </span>
        <CopyTextButton text={value} />
      </div>
      {warnings.length > 0 ? (
        <ul className="flex flex-col gap-1 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs text-amber-200" role="status">
          {warnings.map((warning) => (
            <li key={warning} className="flex items-start gap-1.5">
              <AlertTriangle className="mt-px size-3.5 shrink-0" />
              {warning}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
