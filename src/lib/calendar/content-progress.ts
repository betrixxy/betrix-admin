import { CONTENT_TYPES } from "@/lib/dashboard/content-types";
import type { FixtureProduction } from "@/types/calendar";
import type { ContentTypeDef } from "@/types/content-type";

export interface ProductionSummary {
  /** Onaylanmış (yayına hazır) içerik türü sayısı. */
  approved: number;
  /** Üretilmiş ama onay bekleyen içerik türü sayısı. */
  draft: number;
  /** Paydadaki türler — varsayılan: katalogdaki AKTİF türler ("Yakında" olanlar sayılmaz). */
  total: number;
}

const ACTIVE_TYPES = CONTENT_TYPES.filter((type) => type.status === "active");

/** Bir maçın içerik paketi ilerlemesi — İçerik Planı satırı ve maç sayfası buradan okur. Saf. */
export function summarizeProduction(production: FixtureProduction, types: readonly ContentTypeDef[] = ACTIVE_TYPES): ProductionSummary {
  let approved = 0;
  let draft = 0;
  for (const type of types) {
    const item = production[type.id];
    if (item?.status === "approved") approved++;
    else if (item?.status === "draft") draft++;
  }
  return { approved, draft, total: types.length };
}

/** "3/6 hazır · 1 onay bekliyor" — onay bekleyen yoksa yalnızca "3/6 hazır". */
export function formatProductionSummary(summary: ProductionSummary): string {
  const ready = `${summary.approved}/${summary.total} hazır`;
  return summary.draft > 0 ? `${ready} · ${summary.draft} onay bekliyor` : ready;
}
