import type { Fixture } from "@/types/sports";

export type { FixtureStatus, DerbyIntensity, TeamRef, CompetitionRef } from "@/types/sports";

/**
 * İçerik takviminin bu FAZ'daki sadeleştirilmiş görünümü.
 * Tam durum makinesi (bkz. CLAUDE.md 4.2) backend bağlandığında devreye girer.
 */
export type ContentStatus = "idea" | "pending" | "produced";

export type AdPlatform = "meta" | "tiktok" | "youtube" | "x";

export interface AdSpend {
  meta?: number;
  tiktok?: number;
  youtube?: number;
  x?: number;
  currency: string;
}

export interface ContentPlan {
  id: string;
  /** Hedeflenen maç — bkz. CalendarFixture.id */
  fixtureId: string;
  /** İçeriğin üretim/yayın tarihi — genelde maçtan 1-2 gün öncesi (ISO 8601, UTC). */
  scheduledFor: string;
  platforms: AdPlatform[];
  adSpend: AdSpend;
}

/**
 * `contentPlan` isteğe bağlıdır: yalnızca derbi/rekabet seviyesi taşıyan maçlar otomatik
 * içerik planı alır (bkz. mock-fixtures.ts). Sıradan (`NONE`) maçlar planı olmadan var
 * olabilir ama içerik takviminde (bkz. month-grid.tsx) gösterilmez.
 */
export interface CalendarFixture extends Fixture {
  contentStatus: ContentStatus;
  contentPlan?: ContentPlan;
}

/** `contentPlan` alanı garanti dolu olan, takvimde gösterilmeye uygun fikstür. */
export interface PlannedCalendarFixture extends CalendarFixture {
  contentPlan: ContentPlan;
}
