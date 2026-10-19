import type { PredictionSet, ScenarioId } from "@/types/prediction";
import type { MatchDayFormatId } from "@/types/match-day";
import type { MatchResultLetter } from "@/types/sports";

/**
 * Maç önü "vitrin" carousel'i (AI_MARKET_PREDICTION) — iki sayfanın (01 Poster, 02 Analiz) Satori
 * şablonlarının okuduğu alanlar. Kilitli kutular YALNIZCA başlık taşır: gerçek sonuç/olasılık bu
 * tipe hiç girmez (cevap yerine sabit "• • •" çizilir, bkz. `templates/vitrin/`).
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

/** Poster kazanma çubuğu: 1X2 tamsayı yüzdeleri (toplam 100) + kurala dayalı tek satır manşet. */
export interface VitrinWinBar {
  home: number;
  draw: number;
  away: number;
  /** Favori net ise taraf (manşette takım adı kendi renginde), kararsızsa null. */
  favourite: "HOME" | "AWAY" | null;
  headline: string;
}

export interface VitrinCard {
  /** "01 · MAÇ ÖNÜ" / "02 · ANALİZ" — ilk parça vurgu renginde (SetHeader). */
  pageLabels: [string, string];
  dateLabel: string;
  competitionLabel: string;
  roundLabel: string;
  accentHex: string;
  homeTeam: string;
  awayTeam: string;
  homeLogo: string | null;
  awayLogo: string | null;
  /** Kulüp renkleri — koyu zeminde okunur, birbirine ve beraberlik grisine benzemez. */
  homeHex: string;
  awayHex: string;
  /** Son 5 maç, eskiden yeniye (en yeni sağda). */
  homeForm: MatchResultLetter[];
  awayForm: MatchResultLetter[];
  brandLogo: string;
  winBar: VitrinWinBar;
  /** 1. kutu her zaman kazanma olasılıkları (poster çubuğu); 2. kutu analiz sayfasının göstergesi. */
  open: [VitrinOpenBox, VitrinOpenBox];
  /** Yalnızca başlıklar. */
  locked: [string, string, string];
  /** Kilitli bölümün köşe rozeti: açık kutuların dışında kalan senaryo sayısı (N − 2). */
  hiddenCount: number;
  /** Gönderi metninin iki satırlık kancası (link yok). */
  hook: [string, string];
  /** Kartın alt kancası — tek satır (link yok). */
  hookLine: string;
}

/** Stüdyonun kutu seçimi: tam 2 açık (1. her zaman RESULT_1X2), 3 kilitli. */
export interface VitrinSelection {
  open: [ScenarioId, ScenarioId];
  locked: [ScenarioId, ScenarioId, ScenarioId];
}

/** `AiContent.renderOptions` (kind = "VITRIN") — yeniden çizim ve onayda tahmin kaydı bunu okur. */
export interface VitrinRenderOptions extends VitrinSelection {
  kind: "VITRIN";
  format: MatchDayFormatId;
  prediction: PredictionSet;
  /** Ev sahibi arşiv fotoğrafı (Photo.id); kart büyütülmüş sürümü kullanır. */
  photoId: string | null;
  /** Deplasman arşiv fotoğrafı (poster iki taraflı); eski kayıtlarda yok. */
  awayPhotoId?: string | null;
}
