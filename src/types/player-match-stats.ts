import type { NameOrigin } from "@/lib/dashboard/name-case";
import type { MatchDayFormatId } from "./match-day";
import type { MatchResultFacts, MatchSide } from "./match-result";
import type { StudioJobStart } from "./studio-job";

/**
 * OYUNCU İSTATİSTİKLERİ (`AiContent.contentType = "PLAYER_STATS"`, maç sonrası) — kanonik tipler.
 * Veri TEK kaynaktan: API-Football maç oyuncu istatistikleri (`/fixtures?id=` → `players`). Tek istisna xG:
 * Sportmonks'ta oyuncunun o maçtaki dakikası birebir tutuyorsa (dipnotta kaynağıyla). Eksik veri asla 0
 * yazılmaz: satır düşer, yedekten sıradaki gelir. Yalnızca biten maç (FT/AET/PEN), veri kesinleşmişse.
 */

/** A · Maçın Oyuncusu (tek oyuncu, tam kadraj ya da tipografik) · B · Maçın En İyileri (3 ya da 5 oyuncu). */
export const PLAYER_STATS_TEMPLATE_IDS = ["SPOTLIGHT", "TOP_PLAYERS"] as const;
export type PlayerStatsTemplateId = (typeof PLAYER_STATS_TEMPLATE_IDS)[number];

export const TOP_PLAYER_COUNTS = [3, 5] as const;
export type TopPlayerCount = (typeof TOP_PLAYER_COUNTS)[number];

/** API-Football maç mevkisi: G kaleci · D defans · M orta saha · F forvet. */
export type PlayerPosition = "G" | "D" | "M" | "F";

/** Ham, normalize edilmiş maç içi sayılar — sağlayıcı boş bıraktıysa null (asla 0'a çevrilmez). */
export interface PlayerMatchNumbers {
  goals: number | null;
  assists: number | null;
  shotsTotal: number | null;
  shotsOn: number | null;
  keyPasses: number | null;
  passesTotal: number | null;
  /** İsabetli pas SAYISI (`passes.accuracy`, maç ucunda sayıdır). */
  passesAccurate: number | null;
  dribblesAttempts: number | null;
  dribblesSuccess: number | null;
  duelsTotal: number | null;
  duelsWon: number | null;
  tackles: number | null;
  interceptions: number | null;
  blocks: number | null;
  saves: number | null;
  conceded: number | null;
  penaltySaved: number | null;
  foulsDrawn: number | null;
}

export interface PlayerMatchLine {
  playerId: number;
  /** Sağlayıcı adı ("S. Mbangula"); kart adı `names` katmanından gelir. */
  name: string;
  side: MatchSide;
  teamId: number;
  position: PlayerPosition | null;
  minutes: number | null;
  rating: number | null;
  numbers: PlayerMatchNumbers;
  /** Sportmonks xG — yalnızca dakika birebir tutuyorsa; yoksa null. */
  xg: number | null;
}

/** Kartın satır anahtarları (mevki öncelik listeleri bunlardan kurulur). */
export const PLAYER_STAT_KEYS = [
  "goals",
  "assists",
  "shots",
  "xg",
  "bigChances",
  "dribbles",
  "keyPasses",
  "touches",
  "passAccuracy",
  "duels",
  "recoveries",
  "interceptions",
  "clearances",
  "aerials",
  "blocks",
  "saves",
  "conceded",
  "penaltySaved",
  "sweeper",
  "tackles",
  "passes",
  "foulsDrawn",
] as const;
export type PlayerStatKey = (typeof PLAYER_STAT_KEYS)[number];

export type PlayerStatSource = "API_FOOTBALL" | "SPORTMONKS";

/** Sportmonks diziliş oyuncusu — yalnızca xG eşleşmesi için (bkz. `lib/player-stats/xg.ts`). */
export interface SportmonksLineupPlayer {
  /** Sportmonks takım kimliği. */
  teamId: number;
  name: string;
  jersey: number | null;
  minutes: number | null;
  xg: number | null;
}

/** Karta yazılacak tek satır (değer okunmuşsa). */
export interface PlayerStatRow {
  key: PlayerStatKey;
  /** "İSABETLİ ŞUT / ŞUT" */
  label: string;
  /** "3/4", "%92", "0,87" */
  value: string;
  /** B kartındaki kısa yazım: "3 gol", "%92 pas isabeti". */
  short: string;
  /** Kahraman seçimi için: değer sıfır mı (sıfır satır kahraman olmaz). */
  zero: boolean;
  source: PlayerStatSource;
}

/** Veri kesinleşti mi — kesinleşmediyse stüdyo kart üretmez, "yeniden dene" sunar. */
export type PlayerDataSettlement = { settled: true } | { settled: false; reason: string };

/** Bitmiş maçın oyuncu verisi — üretim anında `statsSnapshot`'a yazılır. */
export interface PlayerStatsFacts {
  match: MatchResultFacts;
  lines: PlayerMatchLine[];
  settlement: PlayerDataSettlement;
  /** Sportmonks maçı eşleşti mi (xG için); eşleşmediyse xG hiç yok. */
  sportmonksMatched: boolean;
  /** Dakikası tutup xG'si okunan oyuncu sayısı. */
  xgMatched: number;
}

/** Kartta görünen oyuncu (adı büyük harfli, satırları seçilmiş). */
export interface PlayerCardEntry {
  playerId: number;
  name: string;
  teamName: string;
  teamHex: string;
  teamLogo: string | null;
  /** Vesikalık (`data:` URI); yoksa takım logosu çizilir. */
  portrait: string | null;
  rating: number;
  ratingText: string;
  minutes: number | null;
  /** "FORVET" */
  positionLabel: string | null;
}

interface PlayerCardBase {
  accentHex: string;
  /** "03 · MAÇIN OYUNCUSU"; tek başına paylaşımda null. */
  pageLabel: string | null;
  /** "MILAN 2–4 BOLOGNA" */
  matchLine: string;
  /** "SERIE A · 9. HAFTA · 28.10.2026" */
  metaLine: string;
  /** "Puan: API-Football · xG: Sportmonks" */
  footnote: string;
  brandLogo: string;
}

/** A · MAÇIN OYUNCUSU */
export interface SpotlightCard extends PlayerCardBase {
  player: PlayerCardEntry;
  /** "BOLOGNA · FORVET · 90 DK" */
  metaRow: string;
  hero: PlayerStatRow[];
  rows: PlayerStatRow[];
  fact: string | null;
  /** Fotoğraf yoksa tipografik yedek: dev ad zemin üstünde. */
  typographic: boolean;
  /** Tipografik yedekte dev adın satırları ("SAMUEL" / "MBANGULA"). */
  heroName: string[];
}

export interface TopPlayerRow extends PlayerCardEntry {
  rank: number;
  /** "3 gol · 1 asist" */
  highlight: string;
}

/** B · MAÇIN EN İYİLERİ */
export interface TopPlayersCard extends PlayerCardBase {
  title: string;
  rows: TopPlayerRow[];
}

export interface PlayerStatsGenerationResult {
  id: string;
  imageUrl: string;
  format: MatchDayFormatId;
  template: PlayerStatsTemplateId;
  paidCalls: number;
  notes: string[];
}

export interface PlayerStatsActionState {
  error?: string;
  /** Veri kesinleşmedi — stüdyo "yeniden dene" düğmesi gösterir. */
  notSettled?: boolean;
  result?: PlayerStatsGenerationResult;
  job?: StudioJobStart;
}

/** Ad büyük harfi için köken haritası (oyuncu kimliği → köken). */
export type PlayerOrigins = Map<number, NameOrigin | null>;
