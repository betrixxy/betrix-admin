"use client";

import { dismissLegacyAssetAction } from "@/app/dashboard/library/archive-directory-actions";
import { Button } from "@/components/ui/button";
import { useActionForm } from "@/hooks/use-action-form";
import type { InboxAsset } from "@/lib/archive/queries";
import type { ArchiveActionState } from "@/types/archive";

const INITIAL: ArchiveActionState = {};

/** Arşive almadan gizle / gizlenenlerde geri getir — dosya ve eski kayıt yerinde kalır. */
export function DismissButton({ assetId, restore }: { assetId: string; restore: boolean }) {
  const { state, isPending, onSubmit } = useActionForm(dismissLegacyAssetAction, INITIAL);
  if (state.notice) return <span className="text-[11px] text-emerald-400">{state.notice}</span>;
  return (
    <form onSubmit={onSubmit} className="flex items-center gap-2">
      <input type="hidden" name="assetId" value={assetId} />
      <input type="hidden" name="dismissed" value={restore ? "0" : "1"} />
      <Button type="submit" size="sm" variant="ghost" className="h-7 text-[11px] text-muted-foreground" disabled={isPending}>
        {restore ? "Geri getir" : "Gizle (arşive alma)"}
      </Button>
      {state.error ? <span className="text-[11px] text-destructive">{state.error}</span> : null}
    </form>
  );
}

/** Gizlenenler görünümünde tek satır: küçük resim + "Geri getir". */
export function HiddenInboxItem({ asset }: { asset: InboxAsset }) {
  return (
    <li className="flex items-center gap-3 rounded-lg border border-border p-3">
      {/* eslint-disable-next-line @next/next/no-img-element -- oturumlu /api/files görseli */}
      <img src={asset.fileUrl} alt={asset.label} loading="lazy" className="aspect-[4/5] w-16 shrink-0 rounded object-cover" />
      <span className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground" title={asset.label}>{asset.label}</span>
      <DismissButton assetId={asset.id} restore />
    </li>
  );
}
