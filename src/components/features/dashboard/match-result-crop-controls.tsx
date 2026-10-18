"use client";

import { useState } from "react";
import { AlertCircle, Crop, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { MatchPhotoPreviewState } from "@/types/match-result";

interface MatchResultCropControlsProps {
  state: MatchPhotoPreviewState;
  isPending: boolean;
  onPreview: () => void;
}

function Slider({ name, label, min, max, step, value, onChange, disabled = false }: { name: string; label: string; min: number; max: number; step: number; value: number; onChange: (value: number) => void; disabled?: boolean }) {
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={name} className="flex justify-between text-xs">
        <span>{label}</span>
        <span className="tabular-nums text-muted-foreground">{value.toFixed(2)}</span>
      </Label>
      <input id={name} type="range" min={min} max={max} step={step} value={value} disabled={disabled} onChange={(event) => onChange(Number(event.target.value))} className="accent-emerald-500" />
    </div>
  );
}

/**
 * Kırpma önizlemesi + elle kaydırma. Akıllı kırpma (yüz tespiti, yazısız bölge, 16:9 aynalama)
 * otomatik; kaydırıcılar kadraj boyunun yarısı kadar (−1..1) kaydırır, zoom otomatikte yüzler sığana
 * kadar yakınlaşır. Değerler gizli alan olarak üretime gider — önizleme ile kart aynı kırpmayı kullanır.
 */
export function MatchResultCropControls({ state, isPending, onPreview }: MatchResultCropControlsProps) {
  const [x, setX] = useState(0);
  const [y, setY] = useState(0);
  const [autoZoom, setAutoZoom] = useState(true);
  const [zoom, setZoom] = useState(1);
  const preview = state.preview;

  return (
    <fieldset className="flex flex-col gap-3 rounded-lg border border-border p-3">
      <legend className="px-1 text-sm font-medium">Kırpma</legend>
      <input type="hidden" name="offsetX" value={x === 0 ? "" : String(x)} />
      <input type="hidden" name="offsetY" value={y === 0 ? "" : String(y)} />
      <input type="hidden" name="zoom" value={autoZoom ? "" : String(zoom)} />
      <div className="grid gap-3 sm:grid-cols-3">
        <Slider name="crop-x" label="Yatay kaydırma" min={-1} max={1} step={0.05} value={x} onChange={setX} />
        <Slider name="crop-y" label="Dikey kaydırma" min={-1} max={1} step={0.05} value={y} onChange={setY} />
        <div className="flex flex-col gap-1">
          <label className="flex items-center gap-1.5 text-xs">
            <input type="checkbox" checked={autoZoom} onChange={(event) => setAutoZoom(event.target.checked)} />
            Otomatik zoom
          </label>
          <Slider name="crop-zoom" label="Zoom" min={1} max={1.6} step={0.05} value={autoZoom ? (preview?.zoom ?? 1) : zoom} onChange={setZoom} disabled={autoZoom} />
        </div>
      </div>
      <Button type="button" variant="outline" size="sm" onClick={onPreview} disabled={isPending}>
        <Crop />
        {isPending ? "Kırpılıyor…" : "Kırpmayı önizle"}
      </Button>
      {state.error ? (
        <p className="flex items-center gap-1.5 text-xs text-destructive" role="alert">
          <AlertCircle className="size-3.5 shrink-0" />
          {state.error}
        </p>
      ) : null}
      {preview ? (
        <div className="flex flex-col gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element -- data: URI önizleme */}
          <img src={preview.imageDataUri} alt="Kırpma önizlemesi (sarı çerçeve: yazısız bölge)" className="w-full rounded border border-border" />
          <p className="text-xs text-muted-foreground">
            {preview.faces} yüz · {preview.facesInSafe ? "yüzler yazısız bölgede" : "yüzler yazısız bölgeye tam sığmadı — kaydırın"} · zoom {preview.zoom}
            {preview.side === "left" ? " · 16:9 sütun sola aynalandı" : ""} · keskinlik {preview.sharpness}
            {preview.upscaled ? ` · AI büyütüldü (${preview.paidCalls ? "1 ücretli çağrı" : "önbellekten"})` : ""}
          </p>
          {preview.warnings.map((warning) => (
            <p key={warning} className="flex items-center gap-1.5 text-xs text-amber-300">
              <Info className="size-3.5 shrink-0" />
              {warning}
            </p>
          ))}
        </div>
      ) : (
        <p className="text-[11px] text-muted-foreground">Kaynak kısa kenarı 1080&apos;in altındaysa önizleme 1 AI büyütme çağrısı yapar; sonuç önbelleğe girer, kart üretimi tekrar ücretlendirmez.</p>
      )}
    </fieldset>
  );
}
