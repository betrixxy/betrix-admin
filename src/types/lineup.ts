import type { SocialFormatId } from "@/types/studio-formats";

/**
 * "Muhtemel 11" stüdyosu kanonik tipleri — bkz. app/dashboard/studio/lineup,
 * lib/services/api-football/lineups.ts ve templates/lineup/lineup-card.tsx.
 */

/** Kadro pozisyonu (API-Football: Goalkeeper/Defender/Midfielder/Attacker). */
export const SQUAD_POSITIONS = ["G", "D", "M", "F"] as const;
export type SquadPosition = (typeof SQUAD_POSITIONS)[number];

export interface SquadPlayer {
  id: number;
  name: string;
  number: number | null;
  position: SquadPosition | null;
}

/** Referans ilk 11'in bir oyuncusu — `grid` = "satır:sütun" (1 = kaleci satırı). */
export interface ReferenceStarter {
  id: number | null;
  name: string;
  number: number | null;
  grid: string | null;
}

/**
 * Taslağın kaynağı: maçın açıklanmış kadrosu (maçtan ~1 saat önce gelir) ya da takımın son
 * bitmiş maçındaki ilk 11 — ikisi de yoksa admin boş formdan doldurur.
 */
export type LineupSource =
  | { kind: "announced" }
  | { kind: "last-match"; date: string; opponent: string }
  | { kind: "none" };

export interface TeamLineupReference {
  teamId: number;
  teamName: string;
  logoUrl: string;
  formation: string | null;
  /** Kaleciden forvete, satır içinde sütun sırasıyla; 11 değilse taslak boş başlar. */
  starters: ReferenceStarter[];
  coach: string | null;
  /** API-Football forma rengi (#RRGGBB) — yoksa boş. */
  colorHex: string;
  source: LineupSource;
  squad: SquadPlayer[];
}

export interface LineupReference {
  fixtureId: string;
  home: TeamLineupReference;
  away: TeamLineupReference;
}

export const LINEUP_SIZE = 11;

/** Formdaki tek pozisyon. Sıra = dizilişin satır sırası (kaleci → forvet, satır içinde soldan sağa). */
export interface LineupSlot {
  /** Kadrodan seçildiyse API oyuncu kimliği; elle yazıldıysa null. */
  playerId: number | null;
  name: string;
  /** Forma numarası metin olarak ("" = yok). */
  number: string;
}

/**
 * Kart yalnızca kesim motorunun yazdığı şeffaf oyuncu PNG'sini kapak olarak kabul eder
 * (birefnet çıktısı, `match-day-cache.ts::playerCutoutUrl`) — formdan gelen başka adres çizilmez.
 */
export const LINEUP_HERO_PATTERN = /^\/api\/files\/generated\/cutout-v\d+-[a-f0-9]{64}\.png$/;

export interface TeamLineupDraft {
  teamName: string;
  logoUrl: string;
  colorHex: string;
  /** Kapak oyuncusunun şeffaf kesimi (LINEUP_HERO_PATTERN) — yalnızca `hero_list` şablonu çizer; boşsa kapaksız. */
  heroImageUrl: string;
  /** "4-2-3-1" gibi; kaleci hariç satırlar toplamı 10 olmalı. */
  formation: string;
  slots: LineupSlot[];
  coach: string;
}

/**
 * Kart şablonu: `pitch` = taktik tahtası (saha çizgili diziliş), `hero_list` = solda kapak
 * oyuncusunun kesimi, sağda saha çizgisiz numara + isim listesi.
 */
export const LINEUP_TEMPLATE_STYLES = ["pitch", "hero_list"] as const;
export type LineupTemplateStyle = (typeof LINEUP_TEMPLATE_STYLES)[number];
export const DEFAULT_LINEUP_TEMPLATE_STYLE: LineupTemplateStyle = "pitch";

export const LINEUP_TEMPLATE_LABELS: Record<LineupTemplateStyle, string> = {
  pitch: "Taktik Tahtası",
  hero_list: "Kahraman Liste",
};

export interface LineupDraft {
  fixtureId: string;
  /** İki takımın kartı aynı şablonla çizilir. */
  templateStyle: LineupTemplateStyle;
  /** Kartın üst etiketi, ör. "MUHTEMEL 11" / "İLK 11". */
  headline: string;
  /** "Süper Lig · 12.10 · 20:00" gibi maç künyesi. */
  matchLabel: string;
  /** Platform/format (küresel kayıt) — iki kart da bu boyutta çizilir. */
  format: SocialFormatId;
  home: TeamLineupDraft;
  away: TeamLineupDraft;
}

/** Takım logosundan okunan renkler (Vibrant swatch'ları, #rrggbb) — logoda karşılığı yoksa null. */
export interface LogoSwatches {
  vibrant: string | null;
  darkVibrant: string | null;
  lightVibrant: string | null;
  muted: string | null;
  darkMuted: string | null;
  lightMuted: string | null;
  /**
   * Logonun (şeffaf ve beyaz zemin hariç) renkli piksel oranı, 0..1. Siyah-beyaz armalarda (Beşiktaş,
   * Juventus) küçük bir renkli detay Vibrant'ı ele geçirir — oran düşükse palet tek renkli kurulur.
   */
  chromaticShare: number;
}

/** Kartın renk paleti — logodan türetilir (`lib/dashboard/lineup-palette.ts`), şablonlar yalnızca bunu okur. */
export interface LineupPalette {
  /** Zemin degradesinin üstü/altı: baskın rengin geceye gömülmüş, beyaz metne AAA kontrast veren hali. */
  backgroundTop: string;
  backgroundBottom: string;
  /** Kapak/saha arkasındaki parıltı. */
  glow: string;
  /** Saha çizgileri, "11", vurgu çizgileri — koyu zeminde yüksek kontrastlı açık renk. */
  accent: string;
  /** Oyuncu numara dairesi/kutusu ve içindeki numaranın rengi. */
  kit: string;
  kitText: string;
  /** Kaleci: kadrodan ayrışan ikinci renk. */
  keeper: string;
  keeperText: string;
  /** İsimler ve başlıklar. */
  text: string;
  /** İkincil metin (rakip, künye, teknik direktör). */
  muted: string;
}

/** Kart çizimi için tek takımın verisi. */
export interface LineupCardInput {
  templateStyle: LineupTemplateStyle;
  team: TeamLineupDraft;
  opponentName: string;
  /** Rakip logosu (API-Football medya adresi); boşsa çizilmez. */
  opponentLogoUrl: string;
  headline: string;
  matchLabel: string;
  format: SocialFormatId;
}
