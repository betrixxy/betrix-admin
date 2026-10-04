import { CONTENT_TYPES } from "@/lib/dashboard/content-types";
import type { FixtureProduction } from "@/types/calendar";

export interface ProductionSummary {
  /** Onaylanmış (yayına hazır) içerik türü sayısı. */
  approved: number;
  /** Üretilmiş ama onay bekleyen içerik türü sayısı. */
  draft: number;
  /** Katalogdaki tüm türler — hedef: her maç için tam paket. */
  total: number;
}

/** Bir maçın içerik paketi ilerlemesi — takvim kartındaki çubuk ve paneldeki özet buradan gelir. */
export function summarizeProduction(production: FixtureProduction): ProductionSummary {
  let approved = 0;
  let draft = 0;
  for (const type of CONTENT_TYPES) {
    const item = production[type.id];
    if (item?.status === "approved") approved++;
    else if (item?.status === "draft") draft++;
  }
  return { approved, draft, total: CONTENT_TYPES.length };
}
