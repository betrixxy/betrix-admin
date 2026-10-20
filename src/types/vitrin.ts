import type { PredictionSet, ScenarioId } from "@/types/prediction";
import type { MatchDayFormatId } from "@/types/match-day";

/**
 * Maç önü "vitrin" kartı (AI_MARKET_PREDICTION) — Satori şablonunun okuduğu alanlar. Kilitli
 * kutular YALNIZCA başlık taşır: gerçek sonuç/olasılık bu tipe hiç girmez (bulanık alanın altında
 * sabit yer tutucu çizilir, bkz. `templates/vitrin/`).
 */

export interface VitrinOpenLine {
  /** "Galatasaray" · "Beraberlik" · "Evet" */
  label: string;
  /** "%64" */
  value: string;
  /** Seçilen (en olası) sonuç — vurgu renginde. */
  picked: boolean;
}

export interface VitrinOpenBox {
  title: string;
  lines: VitrinOpenLine[];
  reason: string;
}

export interface VitrinCard {
  /** "MAÇ ÖNÜ · ANALİZ" — ilk parça vurgu renginde (SetHeader). */
  pageLabel: string;
  dateLabel: string;
  competitionLabel: string;
  roundLabel: string;
  accentHex: string;
  homeTeam: string;
  awayTeam: string;
  homeLogo: string | null;
  awayLogo: string | null;
  brandLogo: string;
  open: [VitrinOpenBox, VitrinOpenBox];
  /** Yalnızca başlıklar. */
  locked: [string, string, string];
  /** Alt kanca, iki satır (link yok). */
  hook: [string, string];
}

/** Stüdyonun kutu seçimi: tam 2 açık, 3 kilitli (katalogdaki 6 senaryodan biri kartta yer almaz). */
export interface VitrinSelection {
  open: [ScenarioId, ScenarioId];
  locked: [ScenarioId, ScenarioId, ScenarioId];
}

/** `AiContent.renderOptions` (kind = "VITRIN") — yeniden çizim ve onayda tahmin kaydı bunu okur. */
export interface VitrinRenderOptions extends VitrinSelection {
  kind: "VITRIN";
  format: MatchDayFormatId;
  prediction: PredictionSet;
  /** Arşiv fotoğrafı (Photo.id); kart büyütülmüş sürümü kullanır. */
  photoId: string | null;
}
