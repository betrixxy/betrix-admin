import type { SetCard } from "./checkmatch-set";
import type { MatchDayFormatId } from "./match-day";
import type { NameOrigin, TeamOrigin } from "@/lib/dashboard/name-case";

/**
 * MAÇ SONUCU kartı (`AiContent.contentType = "MATCH_RESULT"`, maç sonrası) — kanonik tipler.
 * Maç Günü altyapısını (format, Fal düzenleme, kural tabanlı prompt) paylaşır; veri bitmiş
 * maçtan (FT/AET/PEN) gelir.
 */

/**
 * Tam kadraj maç fotoğrafı şablonları: A tam-kadraj (varsayılan) · B dev-skor · C manşet.
 * Eski taslaklarda `renderOptions.template = "HERO_SCORE"` (kesim modu) kalabilir — yalnızca okunur.
 */
export const MATCH_RESULT_TEMPLATE_IDS = ["FULL_FRAME", "BIG_SCORE", "HEADLINE"] as const;
export type MatchResultTemplateId = (typeof MATCH_RESULT_TEMPLATE_IDS)[number];
export const DEFAULT_MATCH_RESULT_TEMPLATE: MatchResultTemplateId = "FULL_FRAME";

/** API-Football league id'den türetilen turnuva — formda salt okunur gösterilir. */
export const COMPETITION_KINDS = ["SUPER_LIG", "UCL", "UEL", "UECL", "TR_CUP", "NATIONAL", "OTHER"] as const;
export type CompetitionKind = (typeof COMPETITION_KINDS)[number];

export type MatchSide = "HOME" | "AWAY";
export type MatchOutcome = MatchSide | "DRAW";

export interface Competition {
  kind: CompetitionKind;
  /** "UEFA Avrupa Ligi" — eşlemesi olmayan ligde sağlayıcının adı. */
  name: string;
  leagueId: number;
  logoUrl: string;
}

/** Bir oyuncunun bir taraftaki golleri tek satırda: "72'", "90+2' (P)", "34' (KK)". */
export interface ScorerLine {
  playerId: number | null;
  /** Kart adı (arşiv düzeltmesi → Sportmonks → API, bkz. `set-people.ts`). */
  name: string;
  minutes: string[];
  /** Büyük harf kökeni (adın harfi → uyruk); çözülmediyse yok → takımın kişi kökeni. */
  origin?: NameOrigin | null;
}

export interface ResultTeam {
  id: number;
  /** Türkçe eşlenmiş ad ("Besiktas" → "Beşiktaş"). */
  name: string;
  logoUrl: string;
  goals: number;
  /** Bu tarafa yazılan goller (kendi kalesine goller dahil — golü kazanan taraf). */
  scorers: ScorerLine[];
  /** Ad büyük harfinin kökeni (bkz. `team-origin.ts`); motor doldurur, yoksa ad kendi harflerinden. */
  origin?: TeamOrigin;
  /** Forma rengi (`#rrggbb`); dizilişte ve renk tablosunda yoksa boş. */
  colorHex: string;
}

export interface MvpCandidate {
  playerId: number;
  name: string;
  side: MatchSide;
  rating: number | null;
  goals: number;
}

/** Bitmiş maçın gerçek verisi — üretim anında `statsSnapshot`'a yazılır. */
export interface MatchResultFacts {
  fixtureId: number;
  /** ISO 8601, UTC */
  kickoffUtc: string;
  statusShort: "FT" | "AET" | "PEN";
  competition: Competition;
  /** "7. Hafta", "Lig Aşaması · 2. Maç", "Çeyrek Final" */
  roundLabel: string;
  home: ResultTeam;
  away: ResultTeam;
  outcome: MatchOutcome;
  /** Penaltı atışları skoru ("4-3"); yoksa null. */
  penaltyScore: string | null;
  /** Form önerisi; kullanıcı değiştirebilir. Veri yoksa null. */
  mvp: MvpCandidate | null;
  /** MVP'yi değiştirmek için seçilebilir oyuncular — iki takım, rating'e göre azalan. */
  players: MvpCandidate[];
}

/** Stüdyo üretim sonucu — önizleme ve maliyet özeti. */
export interface MatchResultGenerationResult {
  id: string;
  resultImageUrl: string;
  /** "İstatistik sayfasını da ekle" seçildiyse carousel'in 02 görseli; yoksa null. */
  statsImageUrl: string | null;
  /** Tonlanmış, kırpılmış fotoğraf (yazısız sanat katmanı). */
  backgroundImageUrl: string;
  format: MatchDayFormatId;
  /** Yapılan ücretli Fal çağrısı (0 ya da 1 — yalnızca AI büyütme; önbellek isabeti 0). */
  paidCalls: number;
  /** Bilgi notları: küçük kaynak uyarısı, aynalama, gizlenen MVP satırı… */
  notes: string[];
  zoom: number;
  facesInSafe: boolean;
  side: "left" | "right";
}

/** Formdaki kırpma önizlemesi — kart üretmeden fotoğraf hattının sonucu (yazısız). */
export interface MatchPhotoPreview {
  /** Kart boyutunda tonlanmış kırpma + yazısız bölge çerçevesi, küçük JPEG `data:` URI. */
  imageDataUri: string;
  faces: number;
  facesInSafe: boolean;
  zoom: number;
  side: "left" | "right";
  sharpness: number;
  upscaled: boolean;
  paidCalls: number;
  warnings: string[];
}

export interface MatchPhotoPreviewState {
  error?: string;
  preview?: MatchPhotoPreview;
}

export interface MatchResultActionState {
  error?: string;
  result?: MatchResultGenerationResult;
}

/**
 * Şablona giden, metinleri biçimlenmiş ve görselleri `data:` URI'ye çözülmüş kart. Skor şeridi,
 * golcüler, sayfa etiketi ve künye alanları set kartlarıyla ortaktır (`SetCard`).
 */
export interface MatchResultCard extends SetCard {
  /** "OH HYEON-GYU"; MVP'siz şablonlarda null. */
  mvpName: string | null;
}
