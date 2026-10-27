"use client";

import { Label } from "@/components/ui/label";

/** Elle kırpma: null = otomatik (varsayılan). Kaydırma −1..1 (kadrajın yarısı), zoom 1..`maxZoom`. */
export interface CropAdjustValue {
  x: number;
  y: number;
  zoom: number | null;
}

function Slider({ id, label, min, max, step, value, onChange }: { id: string; label: string; min: number; max: number; step: number; value: number; onChange: (value: number) => void }) {
  return (
    <div className="flex flex-col gap-0.5">
      <Label htmlFor={id} className="flex justify-between text-[11px]">
        <span>{label}</span>
        <span className="tabular-nums text-muted-foreground">{value.toFixed(2)}</span>
      </Label>
      <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} className="accent-emerald-500" />
    </div>
  );
}

/**
 * Poster fotoğrafı ya da vesikalık için elle ayar. "Otomatik" işaretliyken akıllı kırpma (yüz tespiti)
 * kullanılır; kaldırılınca kaydırma ve zoom uygulanır — profilden bakan yüzler (Salah) için.
 */
export function CropAdjust({ id, title, value, onChange, maxZoom }: { id: string; title: string; value: CropAdjustValue | null; onChange: (value: CropAdjustValue | null) => void; maxZoom: number }) {
  const current = value ?? { x: 0, y: 0, zoom: null };
  return (
    <fieldset className={value ? "flex flex-col gap-1.5 rounded-md border border-border p-2" : "flex flex-col"}>
      <legend className="flex items-center gap-2 px-1 text-[11px] font-medium">
        {title}
        <label className="flex items-center gap-1 font-normal text-muted-foreground">
          <input type="checkbox" checked={value === null} onChange={(event) => onChange(event.target.checked ? null : { x: 0, y: 0, zoom: null })} />
          Otomatik
        </label>
      </legend>
      {value ? (
        <div className="grid grid-cols-3 gap-2">
          <Slider id={`${id}-x`} label="Yatay" min={-1} max={1} step={0.05} value={current.x} onChange={(x) => onChange({ ...current, x })} />
          <Slider id={`${id}-y`} label="Dikey" min={-1} max={1} step={0.05} value={current.y} onChange={(y) => onChange({ ...current, y })} />
          <Slider id={`${id}-zoom`} label="Zoom" min={1} max={maxZoom} step={0.05} value={current.zoom ?? 1} onChange={(zoom) => onChange({ ...current, zoom })} />
        </div>
      ) : null}
    </fieldset>
  );
}
