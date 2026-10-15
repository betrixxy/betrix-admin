"use client";

import { useActionState, useState } from "react";
import { Download } from "lucide-react";
import { importPostsAction } from "@/app/dashboard/posts/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { estimateImport } from "@/lib/services/social/x-budget";
import type { ImportPlatform, SocialActionState } from "@/types/social";
import { ActionNotice } from "./action-notice";

const INITIAL: SocialActionState = {};
const DEFAULT_COUNT = 100;

/** "Geçmiş gönderileri içe aktar" — X kredi harcadığı için sayı ayarlanabilir; tahmini istek/maliyet gösterilir. */
export function ImportPostsForm({ xRemainingToday }: { xRemainingToday: number }) {
  const [state, action, isPending] = useActionState(importPostsAction, INITIAL);
  const [platform, setPlatform] = useState<ImportPlatform>("META_INSTAGRAM");
  const [count, setCount] = useState(DEFAULT_COUNT);
  const estimate = estimateImport(platform, Number.isFinite(count) ? count : 0);

  return (
    <form action={action} className="flex flex-col gap-2">
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <Label htmlFor="import-platform" className="text-xs">Platform</Label>
          <NativeSelect id="import-platform" name="platform" value={platform} onChange={(event) => setPlatform(event.target.value === "X" ? "X" : "META_INSTAGRAM")}>
            <option value="META_INSTAGRAM">Instagram</option>
            <option value="X">X</option>
          </NativeSelect>
        </div>
        <div className="flex w-28 flex-col gap-1">
          <Label htmlFor="import-count" className="text-xs">Gönderi sayısı</Label>
          <Input id="import-count" name="count" type="number" min={1} max={1000} value={count} onChange={(event) => setCount(Number(event.target.value))} />
        </div>
        <Button type="submit" variant="outline" disabled={isPending}>
          <Download className="size-3.5" />
          {isPending ? "İçe aktarılıyor…" : "Geçmiş gönderileri içe aktar"}
        </Button>
      </div>
      <p className="text-[11px] text-muted-foreground">
        {platform === "X"
          ? `Tahmini: ${estimate.requests} istek, en fazla ${estimate.reads} gönderi okuma ≈ $${estimate.ownedUsd.toFixed(3)} (owned read) – $${estimate.standardUsd.toFixed(3)}. Bugün kalan X okuma hakkı: ${xRemainingToday}.`
          : `Tahmini: ${estimate.requests} istek (Instagram'da ücret yok). Story'ler içe aktarılamaz (Meta kısıtı). Zaten kayıtlı gönderiler tekrar eklenmez.`}
      </p>
      <ActionNotice state={state} />
    </form>
  );
}
