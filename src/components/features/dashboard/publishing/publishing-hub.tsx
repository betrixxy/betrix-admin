"use client";

import { useActionState, useState, useTransition } from "react";
import { AlertCircle, Check, CheckCircle2, Download, Info, Send, X } from "lucide-react";
import { decideDraftAction, generateCaptionAction } from "@/app/dashboard/drafts/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { captionWarnings } from "@/lib/dashboard/publish-caption";
import { cn } from "@/lib/utils";
import type { StudioPostOption } from "@/types/ai-content";
import type { DraftActionState } from "@/types/draft";
import { PUBLISH_PLATFORM_DEFS, PUBLISH_PLATFORMS, type PublishLayout, type PublishMedia, type PublishPlatform } from "@/types/publishing";
import { SOCIAL_FORMATS, type SocialFormatId } from "@/types/studio-formats";
import { CaptionEditor } from "./caption-editor";
import { downloadSequence } from "./download-sequence";
import { MediaSequence } from "./media-sequence";

const INITIAL_STATE: DraftActionState = {};

interface PublishingHubProps {
  id: string;
  /** Kayıttaki (şablon) metin — ilk platformun başlangıç metni ve AI olgu kaynağı. */
  caption: string;
  media: PublishMedia[];
  /** Kartın çizildiği format (Maç Günü/eski stüdyo kayıtlarında bilinmiyorsa null). */
  format: SocialFormatId | null;
  postOptions: StudioPostOption[];
  currentPostId: string | null;
  /** ANTHROPIC_API_KEY tanımlı mı — değilse metin şablonda kalır. */
  aiAvailable: boolean;
  downloadName: string;
}

interface CaptionState {
  text: string;
  source: "ai" | "template";
}

/**
 * Yayın Merkezi (bkz. CLAUDE.md 1.10): platform seçimi, platforma özel AI metni, çoklu görsel dizilimi,
 * sıralı indirme ve onay/ret. Onayda platform + düzen + dizilim + son metin kayda işlenir. Platform
 * değiştirildiğinde o platformun metni bir kez Claude ile yazılır (admin tıklaması — ücretli); ilk açılışta
 * çağrı yapılmaz, kayıttaki şablon metni gösterilir.
 */
export function PublishingHub({ id, caption, media, format, postOptions, currentPostId, aiAvailable, downloadName }: PublishingHubProps) {
  const [platform, setPlatform] = useState<PublishPlatform>("IG_POST");
  const [captions, setCaptions] = useState<Partial<Record<PublishPlatform, CaptionState>>>({ IG_POST: { text: caption, source: "template" } });
  const [layout, setLayout] = useState<PublishLayout>(media.length > 1 ? "multi" : "single");
  const [order, setOrder] = useState<PublishMedia[]>(media);
  const [postId, setPostId] = useState(currentPostId ?? "");
  const [captionError, setCaptionError] = useState<string | null>(null);
  const [isGenerating, startGenerating] = useTransition();
  const [isDownloading, setDownloading] = useState(false);
  const [state, formAction, isPending] = useActionState(decideDraftAction, INITIAL_STATE);
  const [, startDeciding] = useTransition();

  const def = PUBLISH_PLATFORM_DEFS[platform];
  const current = captions[platform] ?? { text: caption, source: "template" as const };
  const multi = layout === "multi" && order.length > 1;
  const selected = (multi ? order.slice(0, def.maxMedia) : order.slice(0, 1)).map((item) => item.url);
  const warnings = captionWarnings(current.text, platform, `${caption} ${media.map((item) => item.label).join(" ")}`);
  const formatHint = format && format !== def.recommendedFormat ? `Kart ${SOCIAL_FORMATS[format].label} formatında; ${def.label} için ${SOCIAL_FORMATS[def.recommendedFormat].label} önerilir — gerekirse stüdyoda o formatta yeniden üretin.` : null;

  function generate(target: PublishPlatform) {
    setCaptionError(null);
    startGenerating(async () => {
      const result = await generateCaptionAction(id, target);
      if (!result.ok) {
        setCaptionError(`AI metni yazılamadı: ${result.error.message} — şablon metni kullanılabilir.`);
        setCaptions((previous) => ({ ...previous, [target]: previous[target] ?? { text: caption, source: "template" } }));
        return;
      }
      setCaptions((previous) => ({ ...previous, [target]: { text: result.data.caption, source: result.data.source } }));
    });
  }

  function selectPlatform(next: PublishPlatform) {
    setPlatform(next);
    // Platformun metni yoksa bir kez yazılır; AI kapalıysa şablon metniyle başlar.
    if (captions[next]) return;
    if (aiAvailable) generate(next);
    else setCaptions((previous) => ({ ...previous, [next]: { text: caption, source: "template" } }));
  }

  async function download() {
    setDownloading(true);
    try {
      await downloadSequence(selected, downloadName);
    } finally {
      setDownloading(false);
    }
  }

  function decide(decision: "APPROVED" | "REJECTED") {
    const formData = new FormData();
    formData.set("id", id);
    formData.set("decision", decision);
    formData.set("postId", postId);
    formData.set("platform", platform);
    formData.set("layout", multi ? "multi" : "single");
    formData.set("mediaOrder", JSON.stringify(selected));
    formData.set("caption", current.text);
    startDeciding(() => formAction(formData));
  }

  return (
    <Card className="ring-1 ring-emerald-500/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Send className="size-4 text-emerald-300" />
          Yayın Merkezi
        </CardTitle>
        <CardDescription>Platformu seçin, metni ve görsel sırasını hazırlayın; onayladığınızda seçimler kayda işlenir ve içerik yayına hazır sayılır.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Platform">
          {PUBLISH_PLATFORMS.map((candidate) => (
            <button
              key={candidate}
              type="button"
              role="radio"
              aria-checked={platform === candidate}
              disabled={isGenerating || isPending}
              onClick={() => selectPlatform(candidate)}
              className={cn(
                "flex flex-col gap-0.5 rounded-lg border p-3 text-left transition-colors disabled:opacity-60",
                platform === candidate ? "border-emerald-400/70 bg-emerald-400/10" : "border-border/60 hover:bg-white/[0.04]",
              )}
            >
              <span className="text-sm font-medium">{PUBLISH_PLATFORM_DEFS[candidate].label}</span>
              <span className="text-[11px] leading-snug text-muted-foreground">{PUBLISH_PLATFORM_DEFS[candidate].description}</span>
            </button>
          ))}
        </div>

        {formatHint ? (
          <p className="flex items-start gap-1.5 text-xs text-sky-200">
            <Info className="mt-px size-3.5 shrink-0" />
            {formatHint}
          </p>
        ) : null}

        {media.length > 1 ? (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <Label>Medya dizilimi</Label>
              <div className="grid grid-cols-2 gap-1 rounded-lg bg-white/[0.04] p-1 text-xs" role="radiogroup" aria-label="Düzen">
                {(["single", "multi"] as const).map((candidate) => (
                  <button
                    key={candidate}
                    type="button"
                    role="radio"
                    aria-checked={layout === candidate}
                    onClick={() => setLayout(candidate)}
                    className={cn("rounded-md px-2.5 py-1 transition-colors", layout === candidate ? "bg-white/10 text-foreground" : "text-muted-foreground hover:text-foreground")}
                  >
                    {candidate === "single" ? "Tekli (ilk görsel)" : def.multiLabel}
                  </button>
                ))}
              </div>
            </div>
            <MediaSequence items={order} onChange={setOrder} disabled={isPending} />
            <p className="text-[11px] text-muted-foreground">
              Sürükleyip bırakın ya da oklarla sıralayın — ilk görsel kapak / ilk kare olur.{layout === "single" ? " Tekli düzende yalnız ilk görsel yayınlanır." : ""}
            </p>
          </div>
        ) : null}

        <CaptionEditor
          platform={platform}
          value={current.text}
          onChange={(text) => setCaptions((previous) => ({ ...previous, [platform]: { text, source: current.source } }))}
          warnings={aiAvailable ? warnings : [...warnings, "ANTHROPIC_API_KEY tanımlı değil — metin şablonda kalır."]}
          source={current.source}
          aiAvailable={aiAvailable}
          isGenerating={isGenerating}
          onRegenerate={() => generate(platform)}
          disabled={isPending}
        />
        {captionError ? (
          <p className="flex items-center gap-1.5 text-xs text-destructive" role="alert">
            <AlertCircle className="size-3.5 shrink-0" />
            {captionError}
          </p>
        ) : null}

        <Button type="button" variant="outline" disabled={selected.length === 0 || isDownloading} onClick={download}>
          <Download />
          {selected.length > 1 ? `Görselleri sırayla indir (${selected.length})` : "Görseli indir"}
        </Button>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="publish-post">Takvimdeki gönderiye bağla (isteğe bağlı)</Label>
          <NativeSelect id="publish-post" value={postId} onChange={(event) => setPostId(event.target.value)}>
            <option value="">Bağlama</option>
            {postOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </NativeSelect>
          {postOptions.length === 0 ? <span className="text-[11px] text-muted-foreground">Bu maç için planlanmış gönderi yok (İçerik Takvimi&apos;nden eklenebilir).</span> : null}
        </div>

        {state.error ? (
          <p className="flex items-center gap-1.5 text-xs text-destructive" role="alert">
            <AlertCircle className="size-3.5 shrink-0" />
            {state.error}
          </p>
        ) : state.notice ? (
          <p className="flex items-center gap-1.5 text-xs text-emerald-400" role="status">
            <CheckCircle2 className="size-3.5 shrink-0" />
            {state.notice}
          </p>
        ) : null}

        <div className="grid grid-cols-2 gap-2">
          <Button type="button" disabled={isPending || isGenerating || !current.text.trim()} onClick={() => decide("APPROVED")} className="bg-emerald-600 text-white hover:bg-emerald-500">
            <Check />
            Onayla ({def.label})
          </Button>
          <Button type="button" variant="destructive" disabled={isPending} onClick={() => decide("REJECTED")}>
            <X />
            Reddet
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
