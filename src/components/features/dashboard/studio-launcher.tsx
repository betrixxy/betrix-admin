"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { buildStudioHref, contentTypeOptionLabel, contentTypesForPhase, defaultContentTypeId, getContentType } from "@/lib/dashboard/content-types";
import { cn } from "@/lib/utils";
import type { ContentPhase } from "@/types/content-type";

interface StudioLauncherProps {
  fixtureId: string;
  /** Maçın durumuna göre açık evre (bkz. `match-row-state.ts`); `null` → menü pasif. */
  phase: ContentPhase | null;
  /** Pasif menünün kısa etiketi ve ipucu, ör. { label: "Maç bitince açılır", reason: "Maç sürüyor…" }. */
  disabled?: { label: string; reason: string } | null;
}

/**
 * Maç satırındaki içerik türü menüsü + "Stüdyoya Git". Menü `lib/dashboard/content-types.ts`'ten,
 * maçın evresine göre süzülerek beslenir (biten maç → maç sonrası, başlamamış → maç öncesi türler);
 * aktif tür seçiliyse buton o türün stüdyosuna `?fixtureId=` ile gider, "yakında" türlerde pasif
 * kalır. Üretim burada değil stüdyoda, admin onayıyla başlar (bkz. CLAUDE.md 1.10).
 */
export function StudioLauncher({ fixtureId, phase, disabled = null }: StudioLauncherProps) {
  const [typeId, setTypeId] = useState<string>(() => (phase ? defaultContentTypeId(phase) : null) ?? "");
  const options = phase ? contentTypesForPhase(phase) : [];
  const type = getContentType(typeId);
  const buttonClass = cn(buttonVariants({ size: "sm" }));

  if (!phase) {
    return (
      <div className="flex items-center gap-2" title={disabled?.reason}>
        <NativeSelect disabled aria-label="İçerik türü" className="h-8 max-w-[14rem] text-xs">
          <option>{disabled?.label ?? "İçerik yok"}</option>
        </NativeSelect>
        <button type="button" disabled className={buttonClass}>
          Stüdyoya Git
          <ArrowRight />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <NativeSelect
        value={typeId}
        onChange={(event) => setTypeId(event.target.value)}
        aria-label="İçerik türü"
        className="h-8 max-w-[14rem] text-xs"
      >
        {options.map((option) => (
          <option key={option.id} value={option.id} title={option.description}>
            {contentTypeOptionLabel(option)}
          </option>
        ))}
      </NativeSelect>
      {type?.status === "active" ? (
        <Link href={buildStudioHref(type, fixtureId)} className={buttonClass}>
          Stüdyoya Git
          <ArrowRight />
        </Link>
      ) : (
        <button type="button" disabled className={buttonClass} title="Bu içerik türünün stüdyosu henüz hazır değil.">
          Stüdyoya Git
          <ArrowRight />
        </button>
      )}
    </div>
  );
}
