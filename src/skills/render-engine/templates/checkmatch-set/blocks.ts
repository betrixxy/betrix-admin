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
  // Oyuncu karşılaştırması (bkz. templates/player-h2h/).
  "players",
  "hero",
  "fact",
  "faces",
  "chart",
  "footnote",
  // Kura sonucu (bkz. templates/draw/).
  "draw-kicker",
  "draw-hero",
  "draw-meta",
  "draw-fact",
  "draw-list",
  // Liste sayfası başlığının alt satırı — büyük başlıktan AYRI blok (Ç/Ş kuyruğu alt satıra binmesin).
  "draw-subtitle",
  // Mürekkep katmanları (bkz. INK_LAYERS): bir bloğun içinde tekrar eden satırlar.
  "draw-names",
  "draw-lines",
  // Maç Günü DATA_DRIVEN: alt alta ad satırları (kırılan uzun ad dahil) sırayla iki katmanda.
  "md-name-a",
  "md-name-b",
  // Genel: bir blok içinde alt alta duran satırlar (ad/soyad, başlık/alt başlık, satır satır liste) sırayla.
  "stack-a",
  "stack-b",
  // Lig kartları (Haftanın Maçları, Puan Durumu) ve Muhtemel 11.
  "card-header",
  "card-body",
  "card-footer",
  "opponent",
  // Maç Günü: tarih/saat/stadyum bloğu ve istatistik/künye kutuları.
  "md-date",
  "md-boxes",
  // Tahmin Karnesi (bkz. templates/prediction-scorecard/).
  "karne-hero",
  "karne-strip",
  "karne-rows",
  "karne-versions",
  /** SONDA — hiçbir şablon kullanmaz: bununla çizilince bütün bloklar gizlenir, görünen kalan öğe bloksuzdur. */
  "unassigned",
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
  players: "oyuncu adları",
  hero: "kahraman istatistikler",
  fact: "olgu satırı",
  faces: "oyuncu yüzleri",
  chart: "karşılaştırma grafiği",
  footnote: "dipnot",
  "draw-kicker": "üst satır (takım / tur)",
  "draw-hero": "rakip / başlık",
  "draw-meta": "sıra ve tarih",
  "draw-fact": "olgu satırı",
  "draw-list": "eşleşme listesi",
  "draw-subtitle": "başlığın alt satırı",
  "draw-names": "listedeki takım adları / logolar",
  "draw-lines": "listedeki alt satırlar (yer, torba, tarih, sıra)",
  "md-name-a": "takım adı satırı (tek)",
  "md-name-b": "takım adı satırı (çift)",
  "stack-a": "alt alta satır (tek)",
  "stack-b": "alt alta satır (çift)",
  "card-header": "başlık",
  "card-body": "kart gövdesi",
  "card-footer": "alt bant",
  opponent: "rakip",
  "md-date": "tarih, saat ve stadyum",
  "md-boxes": "istatistik kutuları",
  "karne-hero": "isabet özeti",
  "karne-strip": "tuttu/tutmadı şeridi",
  "karne-rows": "karne satırları",
  "karne-versions": "model sürümü satırları",
  unassigned: "hiçbir bloğa ait olmayan öğe",
};

/**
 * Mürekkep katmanları: bir bloğun İÇİNDE tekrar eden satırlar (liste satırında ad → altındaki satır). Sınır
 * kutuları her zaman üst üste biner (ikisi de bütün listeyi kaplar), bu yüzden kutuyla değil PİKSEL düzeyinde
 * denetlenir: bir katmanın mürekkebi diğerininkine `INK_CLEARANCE` pikselden yakınsa çakışma. Katman, ait
 * olduğu bloğun yerine geçmez — blok kendi kutusuyla ayrıca denetlenir.
 */
export const INK_LAYERS: ReadonlySet<LayoutBlockId> = new Set<LayoutBlockId>(["draw-names", "draw-lines", "md-name-a", "md-name-b", "stack-a", "stack-b"]);
/**
 * Genel kural: bir bloğun içinde alt alta duran her satır (Anton başlık ve altındaki/üstündeki satır) sırayla
 * `stack-a` / `stack-b` katmanına düşer — komşu satırların mürekkebi piksel düzeyinde denetlenir. Katmanı
 * olmayan öğe (logo, halka) katman ölçülürken gizlenir (`unlayered`), yanlış temas üretmez.
 */
export const STACK_LAYERS = ["stack-a", "stack-b"] as const satisfies readonly LayoutBlockId[];
export const stackLayer = (index: number): LayoutBlockId => (index % 2 === 0 ? "stack-a" : "stack-b");
export const MATCH_DAY_NAME_LAYERS = ["md-name-a", "md-name-b"] as const satisfies readonly LayoutBlockId[];
export const DRAW_LIST_LAYERS = ["draw-names", "draw-lines"] as const satisfies readonly LayoutBlockId[];

/** `only` verilmişse yalnızca o blok görünür; verilmemişse (normal çizim) hepsi. */
export type BlockFilter = LayoutBlockId | undefined;

/** Blok görünürlüğü; `layers`: bloğun mürekkep katmanları ölçülürken blok kabı da görünür kalır. */
export const blockOpacity = (only: BlockFilter, id: LayoutBlockId, layers: readonly LayoutBlockId[] = []): number => (only && only !== id && !layers.includes(only) ? 0 : 1);

/** Blok içindeki öğenin katmanı: başka bir katman ölçülürken gizli; blok ölçülürken ya da normal çizimde görünür. */
export const layerOpacity = (only: BlockFilter, layer: LayoutBlockId): number => (only && INK_LAYERS.has(only) && only !== layer ? 0 : 1);

/** Katmanı olmayan öğe: herhangi bir katman ölçülürken gizli. */
export const unlayered = (only: BlockFilter): number => (only && INK_LAYERS.has(only) ? 0 : 1);
