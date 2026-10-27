/**
 * KURA SONUCU kartı — kanonik tipler. Kura sırasında eşleşmeler elle (hızlı) girilir; eksik eşleşmeyle de
 * kart üretilir (yalnızca girilenlerle). Kura sonrası API fikstürüyle karşılaştırılır, otomatik düzeltme yok.
 * Yorum yok ("zorlu kura" vb.), yalnızca olgu; turnuva logosu KULLANILMAZ (adı tipografik).
 */

/** Eleme turu (iki ayaklı eşleşme) ya da lig aşaması (takım başına N rakip: ŞL/AL 8, KL 6). */
export const DRAW_STAGES = ["KNOCKOUT", "LEAGUE_PHASE"] as const;
export type DrawStage = (typeof DRAW_STAGES)[number];

/** A: takım odaklı · B: temsilcilerimiz (Türk takımları) · C: tüm eşleşmeler (eleme). */
export const DRAW_VARIANTS = ["TEAM", "TURKISH", "ALL"] as const;
export type DrawVariant = (typeof DRAW_VARIANTS)[number];

export interface DrawTeam {
  /** API-Football takım kimliği. */
  id: number;
  apiName: string;
  /** API-Football ülke adı ("Turkey") — Türk takımı vurgusu ve ad büyük harfi. */
  country: string | null;
  logoUrl: string | null;
  /** Torba numarası (biliniyorsa; API vermez, elle girilir). */
  pot: number | null;
}

/** Eleme eşleşmesi: `first` ilk maçın ev sahibi. Tarihler biliniyorsa. */
export interface KnockoutTie {
  first: number;
  second: number;
  firstLegUtc: string | null;
  secondLegUtc: string | null;
}

/** Lig aşaması: takımın bir rakibi (iç saha / deplasman), tarih biliniyorsa. */
export interface LeagueFixture {
  teamId: number;
  opponentId: number;
  venue: "HOME" | "AWAY";
  dateUtc: string | null;
}

export interface DrawState {
  /** API-Football turnuva kimliği + kartta tipografik yazılan ad ("UEFA Şampiyonlar Ligi"). */
  competition: { id: number; name: string };
  season: number;
  /** "Lig Aşaması", "Son 16 Turu" … */
  roundLabel: string;
  stage: DrawStage;
  /** Kura tarihi (biliniyorsa) — künyede. */
  drawDateUtc: string | null;
  teams: DrawTeam[];
  ties: KnockoutTie[];
  fixtures: LeagueFixture[];
  /** Admin düzeltmesi: takım kimliği → kart adı (yayıncı adı tablosunu ezer). */
  nameOverrides: Record<number, string>;
}

/** Eşleşme girişinin sonucu — hata okunur cümle. */
export type DrawEdit = { ok: true; state: DrawState } | { ok: false; error: string };

/** Kura sonrası API karşılaştırması: girilen ile API farkları (otomatik düzeltme yok). */
export type DrawDifference =
  | { kind: "MISSING_IN_API"; text: string }
  | { kind: "MISSING_IN_ENTRY"; text: string }
  | { kind: "VENUE_SWAPPED"; text: string };

/** Geçmiş karşılaşma özeti (odak takımın gözünden). */
export interface HeadToHeadRecord {
  played: number;
  wins: number;
  draws: number;
  losses: number;
}

export interface DrawTeamCard {
  id: number;
  /** Kart adı, büyük harf (köken kuralıyla). */
  name: string;
  logo: string | null;
  turkish: boolean;
}

/** A · eleme: tek sayfa poster. */
export interface DrawKnockoutPoster {
  kind: "TEAM_KNOCKOUT";
  team: DrawTeamCard;
  opponent: DrawTeamCard;
  /** "İLK MAÇ DEPLASMANDA" / "İLK MAÇ İÇ SAHADA" */
  order: string;
  /** "1. MAÇ 18.02 · 2. MAÇ 25.02"; tarihler yoksa boş. */
  dates: string;
  fact: string;
}

export interface DrawOpponentCell {
  opponent: DrawTeamCard;
  venue: "HOME" | "AWAY";
  /** "İÇ SAHA" / "DEPLASMAN" */
  venueLabel: string;
  potLabel: string;
  dateLabel: string;
}

/** A · lig aşaması: 01 poster + 02 rakip ızgarası. */
export interface DrawLeagueCarousel {
  kind: "TEAM_LEAGUE";
  team: DrawTeamCard;
  /** "8 RAKİP · 4 İÇ SAHA · 4 DEPLASMAN" (girilenlere göre). */
  summary: string;
  cells: DrawOpponentCell[];
}

/** B · temsilcilerimiz: takım başına satır. */
export interface DrawTurkishRow {
  team: DrawTeamCard;
  /** Çok turnuvalı kartta turnuva etiketi ("ŞAMPİYONLAR LİGİ"); tek turnuvada boş. */
  tag: string;
  /** Eleme: tek rakip + sıra; lig: rakipler (kompakt). */
  opponents: { team: DrawTeamCard; venue: "HOME" | "AWAY" }[];
  order: string;
}

export interface DrawTurkishCard {
  kind: "TURKISH";
  title: string;
  subtitle: string;
  rows: DrawTurkishRow[];
}

/** C · tüm eşleşmeler (eleme turu). */
export interface DrawAllCard {
  kind: "ALL";
  title: string;
  ties: { first: DrawTeamCard; second: DrawTeamCard; highlight: boolean }[];
}

export type DrawCardBody = DrawKnockoutPoster | DrawLeagueCarousel | DrawTurkishCard | DrawAllCard;

export interface DrawCard {
  body: DrawCardBody;
  /** Sayfa etiketleri (carousel'de iki). */
  pageLabels: string[];
  dateLabel: string;
  accentHex: string;
  /** Künye: "UEFA ŞAMPİYONLAR LİGİ · LİG AŞAMASI · KURA 28.08.2026". */
  footerLine: string;
  brandLogo: string;
}
