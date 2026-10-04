import type { ContentTypeId } from "@/types/content-type";
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
 * Takvimdeki gerçek fikstür (API-Football) + veritabanından türetilen içerik durumu
 * (bkz. lib/calendar/calendar-month.ts). `contentPlan` yalnızca admin bir reklam bütçesi
 * kaydettiyse (ContentPlan tablosu) doludur.
 */
export interface CalendarFixture extends Fixture {
  contentStatus: ContentStatus;
  contentPlan?: ContentPlan;
  /** İçerik türü bazında üretim durumu (AiContent.contentType) — yalnızca üretilmiş türler bulunur. */
  production: FixtureProduction;
}

/** Bir maçın bir içerik türü için en ileri kaydı: onaylı varsa o, yoksa en yeni taslak. */
export interface FixtureContentItem {
  status: "approved" | "draft";
  /** Taslak inceleme ekranı: /dashboard/drafts/<draftId> */
  draftId: string;
}

export type FixtureProduction = Partial<Record<ContentTypeId, FixtureContentItem>>;

