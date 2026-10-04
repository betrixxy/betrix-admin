"use client";

import { useState } from "react";
import Link from "next/link";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import type { MediaAssetOption } from "@/types/media";
import { ImageUploadField } from "./image-upload-field";

interface LibraryImageFieldProps {
  /** Form alan adı: yükleme `name`, kütüphane seçimi `${name}AssetId` olarak gönderilir. */
  name: string;
  label: string;
  hint: string;
  options: MediaAssetOption[];
}

/**
 * Stüdyo görsel alanı: medya kütüphanesinden seç ya da yeni yükle. Yeni yüklenen dosya
 * sunucuda kütüphaneye otomatik kaydedilir (bkz. app/dashboard/studio/actions.ts), böylece
 * bir sonraki üretimde listeden seçilebilir.
 */
export function LibraryImageField({ name, label, hint, options }: LibraryImageFieldProps) {
  const [assetId, setAssetId] = useState("");
  const selected = options.find((option) => option.id === assetId);
  const selectId = `${name}-library`;

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={selectId}>{label}</Label>
      <NativeSelect
        id={selectId}
        name={`${name}AssetId`}
        value={assetId}
        onChange={(event) => setAssetId(event.target.value)}
        className="h-8 text-xs"
      >
        <option value="">{options.length ? "Yeni yükle…" : "Kütüphane boş — yeni yükle"}</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </NativeSelect>

      {selected ? (
        <div className="flex h-28 items-center justify-center overflow-hidden rounded-lg bg-muted/20 ring-1 ring-emerald-500/40">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={selected.fileUrl} alt={selected.label} className="size-full object-contain p-1" />
        </div>
      ) : (
        <ImageUploadField name={name} label="" hint={`${hint} · yüklenen görsel kütüphaneye kaydedilir`} />
      )}
      <Link href="/dashboard/library" className="w-fit text-[10px] text-muted-foreground hover:text-white">
        Medya kütüphanesini yönet →
      </Link>
    </div>
  );
}
