import { CONTENT_PHASES, LEGACY_CONTENT_TYPE_IDS, type ActiveContentType, type ContentPhase, type ContentTypeDef, type ContentTypeId } from "@/types/content-type";

/**
 * Maç Merkezi'nin ve Takvim kontrol merkezinin içerik türü kataloğu — TEK kaynak. Yeni bir tür
 * eklemek: `types/content-type.ts`'teki `CONTENT_TYPE_IDS`'e kimliği, buraya bir satır. Stüdyosu
 * hazır olduğunda `status: "active"` ve `route` verilir; menü, "(Yakında)" etiketi, buton durumu ve
 * takvimdeki ilerleme buradan türetilir. Sunucu bağımlılığı yoktur — istemci bileşenleri doğrudan
 * içe aktarır.
 */
export const CONTENT_TYPES: readonly ContentTypeDef[] = [
  // ---- Maç öncesi ----
  {
    id: "MATCH_DAY",
    label: "Maç Günü Kartı",
    description: "Oyuncu fotoğraflı, AI sahneli maç önü posteri — 3 şablon, 4 platform formatı.",
    phase: "pre_match",
    status: "active",
    route: "/dashboard/studio/match-day",
  },
  {
    id: "WEEKLY_FIXTURES",
    label: "Haftanın Maçları",
    description: "Lig haftasının (kupada grup/tur) fikstürü ve skorları tek görselde — Türkiye saatiyle.",
    phase: "pre_match",
    status: "active",
    route: "/dashboard/studio/weekly-fixtures",
  },
  {
    id: "PROBABLE_LINEUPS",
    label: "Muhtemel 11",
    description: "İki takımın muhtemel ilk 11'i ve dizilişi — fotoğrafsız, forma numarası odaklı taktik tahtası.",
    phase: "pre_match",
    status: "active",
    route: "/dashboard/studio/lineup",
  },
  {
    id: "AI_MARKET_PREDICTION",
    label: "AI Market Tahmin & Analiz",
    description: "Maç önü vitrin kartı: kazanma olasılıkları ve senaryolar, denetimli gerekçeler, kilitli kutular (bahis dili yok).",
    phase: "pre_match",
    status: "active",
    route: "/dashboard/studio/market-analysis",
  },
  {
    id: "PLAYER_H2H",
    label: "Oyuncu Karşılaştırması",
    description: "Head to Head: iki oyuncunun sezon istatistikleri karşı karşıya — poster + kelebek grafiği; maçtan açılınca iki takımın önerilen oyuncularıyla dolar.",
    phase: "pre_match",
    status: "active",
    route: "/dashboard/studio/player-h2h",
  },
  {
    id: "DRAWS_AND_PAIRINGS",
    label: "Kura Sonucu",
    description: "Avrupa kupası kurası: takım odaklı poster + rakipler, temsilcilerimiz, tüm eşleşmeler — maçtan açılınca maçın turnuvası ve sezonu seçili gelir (ana giriş: AI İçerik Stüdyosu).",
    phase: "pre_match",
    status: "active",
    route: "/dashboard/studio/draw",
  },
  // ---- Maç sonrası ---- (ilk aktif tür, biten maçlarda menünün varsayılanıdır)
  {
    id: "MATCH_RESULT",
    label: "Maç Sonucu",
    description: "Skor ve golcüler, tam kadraj maç fotoğrafı üstünde — istenirse 02 İstatistik sayfasıyla carousel (yalnızca biten maçlar).",
    phase: "post_match",
    status: "active",
    route: "/dashboard/studio/match-result",
  },
  {
    id: "MATCH_STATS",
    label: "Maç İstatistikleri",
    description: "Topa sahip olma, şut, xG karşılaştırması — CheckMatch set kartı (02, yalnızca biten maçlar).",
    phase: "post_match",
    status: "active",
    route: "/dashboard/studio/match-stats",
  },
  {
    id: "PLAYER_STATS",
    label: "Oyuncu İstatistikleri",
    description: "Maçın Oyuncusu (puan + mevkiye göre istatistik) ya da Maçın En İyileri (3/5 oyuncu) — tek başına ya da Maç Sonucu carousel'inin son sayfası (yalnızca biten maçlar).",
    phase: "post_match",
    status: "active",
    route: "/dashboard/studio/player-stats",
  },
  {
    id: "MATCH_ANALYSIS",
    label: "Maç Analizi",
    description: "Kural tabanlı maç analizi: 01 olay zaman çizelgesi (kırılma anları) + 02 devre devre istatistik — tek başına ya da Maç Sonucu carousel'inde (yalnızca biten maçlar).",
    phase: "post_match",
    status: "active",
    route: "/dashboard/studio/match-analysis",
  },
  {
    id: "PREDICTION_SCORECARD",
    label: "Tahmin Karnesi",
    description: "Onaylanan tahminlerin tuttu/tutmadı karnesi — maç karnesi (A) ya da hafta/ay/sezon karnesi (B); tutmayanlar dahil, seçme yok.",
    phase: "post_match",
    status: "active",
    route: "/dashboard/studio/prediction-scorecard",
  },
  {
    id: "STANDINGS",
    label: "Puan Durumu",
    description: "Ligin (kupada grupların) güncel puan tablosu — dar formatlarda O · AV · P, yatayda tam tablo.",
    phase: "post_match",
    status: "active",
    route: "/dashboard/studio/standings",
  },
];

export const CONTENT_PHASE_LABELS: Record<ContentPhase, string> = {
  pre_match: "Maç Öncesi İçerikler",
  post_match: "Maç Sonrası İçerikler",
};

/** Katalog, evre sırasıyla gruplanmış — kontrol merkezi bu sırayla listeler. */
export const CONTENT_TYPES_BY_PHASE: readonly { phase: ContentPhase; types: ContentTypeDef[] }[] = CONTENT_PHASES.map((phase) => ({
  phase,
  types: CONTENT_TYPES.filter((type) => type.phase === phase),
}));

/** Bir evrenin türleri, katalog sırasıyla — Maç Merkezi menüsü maçın durumuna göre bunu gösterir. */
export function contentTypesForPhase(phase: ContentPhase): ContentTypeDef[] {
  return CONTENT_TYPES.filter((type) => type.phase === phase);
}

/** Evrenin menüsünde varsayılan seçili tür: o evrenin ilk aktif türü (öncesi: Maç Günü, sonrası: Maç Sonucu). */
export function defaultContentTypeId(phase: ContentPhase): ContentTypeId | null {
  return contentTypesForPhase(phase).find((type) => type.status === "active")?.id ?? null;
}

/** Tür tanımı; eski kimlik (`LEGACY_CONTENT_TYPE_IDS`: MARKET_RESULTS, POST_MATCH_REPORT) yeni türe okunur. */
export function getContentType(id: string): ContentTypeDef | undefined {
  const resolved = resolveContentTypeId(id);
  return resolved ? CONTENT_TYPES.find((type) => type.id === resolved) : undefined;
}

export function isContentTypeId(value: string): value is ContentTypeId {
  return CONTENT_TYPES.some((type) => type.id === value);
}

/** Veritabanından okunan tür kimliği → güncel kimlik (eski kimlik eşlenir); bilinmiyorsa null. */
export function resolveContentTypeId(value: string): ContentTypeId | null {
  return isContentTypeId(value) ? value : (LEGACY_CONTENT_TYPE_IDS[value] ?? null);
}

export function contentTypeOptionLabel(type: ContentTypeDef): string {
  return type.status === "coming_soon" ? `${type.label} (Yakında)` : type.label;
}

/** Aktif türün stüdyo adresi, maç kimliğiyle — form bu parametreden otomatik dolar. */
export function buildStudioHref(type: ActiveContentType, fixtureId: string): string {
  return `${type.route}?${new URLSearchParams({ fixtureId }).toString()}`;
}
