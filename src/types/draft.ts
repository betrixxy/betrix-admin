import type { PublishMedia, PublishSettings } from "@/types/publishing";
import type { SocialFormatId } from "@/types/studio-formats";
import type { AiContentStatus, StudioFormat } from "@/types/ai-content";
import type { LineupTemplateStyle } from "@/types/lineup";
import type { DerbyIntensity, MatchStats } from "@/types/sports";

/** Bkz. CLAUDE.md 1.10 — insan onaylı (human-in-the-loop) içerik taslağı tipleri. */

/** Yayın Merkezi'nin her taslak türünde ihtiyaç duyduğu alanlar (bkz. lib/dashboard/publish-caption.ts). */
export interface PublishableDraft {
  /** Yayınlanabilir görseller (iki takımlı kartlarda ev + deplasman). */
  media: PublishMedia[];
  /** Onayda kaydedilen platform + dizilim; karar verilmemişse null. */
  publish: PublishSettings | null;
}

export interface DraftStatSelection {
  includeForm: boolean;
  includeGoals: boolean;
  includeXg: boolean;
  includeHeadToHead: boolean;
}

/** Görselin nasıl çizileceği — admin inceleme ekranında değiştirir, Fal.ai'siz yeniden render edilir. */
export interface DraftRenderOptions {
  selection: DraftStatSelection;
  /** Admin tarafından sınıflandırılır (bkz. CLAUDE.md 3.2.3) — arka plan mood'unu belirler. */
  derbyIntensity: DerbyIntensity;
}

/** İnceleme ekranının ihtiyaç duyduğu, serileştirilebilir taslak görünümü. */
export interface DraftView extends PublishableDraft {
  id: string;
  status: AiContentStatus;
  format: StudioFormat;
  caption: string;
  prompt: string;
  resultImageUrl: string | null;
  postId: string | null;
  stats: MatchStats;
  renderOptions: DraftRenderOptions;
  /** ISO 8601, UTC */
  createdAt: string;
  updatedAt: string;
  reviewedAt: string | null;
}

/** Onay kuyruğu listesi için hafif özet. */
export interface DraftSummary {
  id: string;
  fixtureId: string;
  status: AiContentStatus;
  format: StudioFormat | null;
  resultImageUrl: string | null;
  createdAt: string;
}

export interface DraftActionState {
  error?: string;
  /** Başarılı kaydetme/yeniden render sonrası kısa bilgi mesajı. */
  notice?: string;
}

/** AI Market Tahmin & Analiz taslağı — iki takımın kartı + market tahmini (bkz. market-analysis-engine.ts). */
export interface MarketAnalysisDraftView extends PublishableDraft {
  id: string;
  fixtureId: string;
  status: AiContentStatus;
  caption: string;
  postId: string | null;
  reviewedAt: string | null;
  /** Kartların çizildiği format — format seçiminden önceki kayıtlarda "post". */
  format: SocialFormatId;
  home: { teamName: string; imageUrl: string };
  away: { teamName: string; imageUrl: string };
  marketPick: string;
  marketRationale: string;
}

/**
 * İnceleme ekranı araması: tam taslak, market analizi taslağı (iki kart, onaylanabilir) ya da
 * onay akışı öncesi üretilmiş (maç verisi snapshot'ı olmayan) eski bir kayıt — sonuncusu yalnızca
 * görüntülenir, düzenlenemez.
 */
/** Muhtemel 11 taslağı — iki takımın kadro kartı (bkz. lineup-engine.ts). */
export interface LineupDraftView extends PublishableDraft {
  id: string;
  fixtureId: string;
  status: AiContentStatus;
  caption: string;
  postId: string | null;
  reviewedAt: string | null;
  headline: string;
  format: SocialFormatId;
  /** `templateStyle` = kartın gerçekte çizildiği şablon (takım başına bağımsız). */
  home: { teamName: string; formation: string; imageUrl: string; templateStyle: LineupTemplateStyle };
  away: { teamName: string; formation: string; imageUrl: string; templateStyle: LineupTemplateStyle };
}

/** Haftanın Maçları taslağı — tek kart (bkz. weekly-fixtures-engine.ts). */
export interface WeeklyFixturesDraftView extends PublishableDraft {
  id: string;
  fixtureId: string;
  status: AiContentStatus;
  caption: string;
  postId: string | null;
  reviewedAt: string | null;
  leagueName: string;
  title: string;
  imageUrl: string;
  matchCount: number;
  format: SocialFormatId;
}

/** Puan Durumu taslağı — tek kart (bkz. standings-engine.ts). */
export interface StandingsDraftView extends PublishableDraft {
  id: string;
  fixtureId: string;
  status: AiContentStatus;
  caption: string;
  postId: string | null;
  reviewedAt: string | null;
  leagueName: string;
  title: string;
  kindLabel: string;
  imageUrl: string;
  teamCount: number;
  format: SocialFormatId;
}

export type DraftLookup =
  | { kind: "draft"; draft: DraftView }
  | { kind: "market-analysis"; draft: MarketAnalysisDraftView }
  | { kind: "lineup"; draft: LineupDraftView }
  | { kind: "weekly-fixtures"; draft: WeeklyFixturesDraftView }
  | { kind: "standings"; draft: StandingsDraftView }
  | { kind: "legacy"; id: string; status: AiContentStatus; resultImageUrl: string | null };
