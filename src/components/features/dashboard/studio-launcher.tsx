"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { buildStudioHref, CONTENT_TYPES, contentTypeOptionLabel, DEFAULT_CONTENT_TYPE_ID, getContentType } from "@/lib/dashboard/content-types";
import { cn } from "@/lib/utils";

interface StudioLauncherProps {
  fixtureId: string;
}

/**
 * Maç satırındaki içerik türü menüsü + "Stüdyoya Git". Menü `lib/dashboard/content-types.ts`'ten
 * beslenir; aktif tür seçiliyse buton o türün stüdyosuna `?fixtureId=` ile gider, "yakında" olan
 * türlerde pasif kalır. Üretim burada değil stüdyoda, admin onayıyla başlar (bkz. CLAUDE.md 1.10).
 */
export function StudioLauncher({ fixtureId }: StudioLauncherProps) {
  const [typeId, setTypeId] = useState<string>(DEFAULT_CONTENT_TYPE_ID);
  const type = getContentType(typeId);
  const buttonClass = cn(buttonVariants({ size: "sm" }));

  return (
    <div className="flex items-center gap-2">
      <NativeSelect
        value={typeId}
        onChange={(event) => setTypeId(event.target.value)}
        aria-label="İçerik türü"
        className="h-8 max-w-[14rem] text-xs"
      >
        {CONTENT_TYPES.map((option) => (
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
