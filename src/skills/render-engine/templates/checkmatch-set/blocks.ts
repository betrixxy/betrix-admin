/**
 * Yerleşim çakışma kontrolünün blok kimlikleri (bkz. `lib/dashboard/layout-check.ts`). Satori
 * yerleşim kutusu vermediği için her blok AYNI yerleşimle tek başına görünür çizilir: diğer bloklar
 * `opacity: 0` alır (yer kaplamaya devam eder, konumlar değişmez), görünen bloğun opak pikselleri
 * ölçülür. Arka plan gradyanı (`Shade`) ölçülmez — tasarım gereği her şeyin altındadır.
 */

export const LAYOUT_BLOCKS = [
  "header-label",
  "header-date",
  "headline",
  "strip",
  "scorers",
  "strip-away",
  "scorers-away",
  "panel",
  "title",
  "footer-text",
  "footer-logo",
  // Maç önü vitrin carousel'i (bkz. templates/vitrin/).
  "teams",
  "open-1",
  "open-2",
  "locked",
  "hook",
  "win-bar",
  "form",
] as const;
export type LayoutBlockId = (typeof LAYOUT_BLOCKS)[number];

/** Kullanıcıya gösterilen Türkçe blok adları (çakışma mesajı). */
export const LAYOUT_BLOCK_LABELS: Record<LayoutBlockId, string> = {
  "header-label": "sayfa etiketi",
  "header-date": "tarih",
  headline: "başlık satırı",
  strip: "skor şeridi",
  scorers: "golcüler",
  "strip-away": "deplasman skor satırı",
  "scorers-away": "deplasman golcüleri",
  panel: "istatistik paneli",
  title: "manşet",
  "footer-text": "künye",
  "footer-logo": "CheckMatch logosu",
  teams: "takımlar",
  "open-1": "1. açık kutu (gerekçe satırı)",
  "open-2": "2. açık kutu",
  locked: "kilitli kutular",
  hook: "alt kanca",
  "win-bar": "kazanma çubuğu",
  form: "form rehberi",
};

/** `only` verilmişse yalnızca o blok görünür; verilmemişse (normal çizim) hepsi. */
export type BlockFilter = LayoutBlockId | undefined;

export const blockOpacity = (only: BlockFilter, id: LayoutBlockId): number => (only && only !== id ? 0 : 1);
