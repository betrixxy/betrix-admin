"use client";

import { AlertCircle, Check, Lock } from "lucide-react";
import type { VitrinScenarioRow } from "@/app/dashboard/studio/market-analysis/vitrin-actions";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { FIXED_OPEN, type BoxRole } from "@/lib/prediction/vitrin-roles";
import { REASON_MAX_LENGTH, type ScenarioId } from "@/types/prediction";

export type { BoxRole };

export const ROLE_LABELS: Record<BoxRole, string> = { open: "Açık kutu", locked: "Kilitli kutu", none: "Kartta yok" };

interface VitrinScenarioTableProps {
  rows: VitrinScenarioRow[];
  roles: Record<ScenarioId, BoxRole>;
  reasons: Record<ScenarioId, string>;
  onRole: (id: ScenarioId, role: BoxRole) => void;
  onReason: (id: ScenarioId, reason: string) => void;
}

/**
 * Senaryo tablosu: başlık · modelin seçtiği sonuç ve yüzdeler (DÜZENLENEMEZ — kaynaktan) · gerekçe
 * (düzenlenebilir, ≤160) · kartta rolü. Denetim sonuçları sunucudan; düzenlenen gerekçe kayıtta
 * yeniden denetlenir. Kilitli kutunun gerekçesi kartta görünmez. Rol kapasitesi sabit: dolu bir rol
 * seçilince o roldeki en eski seçim yer değiştirir (bkz. `vitrin-roles.ts`).
 */
export function VitrinScenarioTable({ rows, roles, reasons, onRole, onReason }: VitrinScenarioTableProps) {
  return (
    <ul className="flex flex-col gap-3">
      {rows.map((row) => {
        const role = roles[row.id];
        const reason = reasons[row.id] ?? "";
        const edited = reason !== row.reason;
        return (
          <li key={row.id} className={cn("flex flex-col gap-2 rounded-lg border p-3", role === "open" ? "border-emerald-500/40" : role === "locked" ? "border-amber-500/30" : "border-border opacity-70")}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex min-w-0 flex-col">
                <span className="flex items-center gap-1.5 text-sm font-medium text-white">
                  {role === "locked" ? <Lock className="size-3.5 text-amber-300" /> : null}
                  {row.title}
                </span>
                <span className="text-xs text-muted-foreground">{row.summary}</span>
              </div>
              {/* Kazanma olasılıkları posterin çubuğu — her zaman açık; dolu rol seçilince en eski seçim yer değiştirir. */}
              <NativeSelect value={role} onChange={(event) => onRole(row.id, event.target.value as BoxRole)} disabled={row.id === FIXED_OPEN} title={row.id === FIXED_OPEN ? "Posterin kazanma çubuğu — her zaman açık" : undefined} className="h-8 w-36 text-xs" aria-label={`${row.title} rolü`}>
                {(Object.keys(ROLE_LABELS) as BoxRole[]).map((value) => (
                  <option key={value} value={value}>{ROLE_LABELS[value]}</option>
                ))}
              </NativeSelect>
            </div>
            <Textarea value={reason} onChange={(event) => onReason(row.id, event.target.value)} rows={2} maxLength={REASON_MAX_LENGTH + 40} className="text-xs" disabled={role !== "open"} />
            <div className="flex items-center justify-between text-[11px]">
              {edited ? (
                <span className="text-muted-foreground">Düzenlendi — kayıtta yeniden denetlenir.</span>
              ) : row.issues.length ? (
                <span className="flex items-center gap-1 text-destructive"><AlertCircle className="size-3" />{row.issues.join(" · ")}</span>
              ) : (
                <span className="flex items-center gap-1 text-emerald-400"><Check className="size-3" />Denetimden geçti</span>
              )}
              <span className={reason.length > REASON_MAX_LENGTH ? "text-destructive" : "text-muted-foreground"}>{reason.length}/{REASON_MAX_LENGTH}</span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
