/**
 * OYUNCU KARŞILAŞTIRMASI (Head to Head) — maç öncesi, iki oyuncu, sezon istatistikleri. Kanonik
 * tipler: veri katmanı (`lib/player-h2h/`), kart alanları ve Satori şablonları
 * (`templates/player-h2h/`) bunları okur. Eksik veri hiçbir yerde 0 değildir: alan yoksa `undefined`.
 */

/** Kapsam: oyuncunun takımının bu sezonki yurt içi ligi ya da takımla oynadığı bütün turnuvalar. */
export const H2H_SCOPES = ["LEAGUE", "ALL"] as const;
export type H2HScope = (typeof H2H_SCOPES)[number];

/** Adalet: sezon toplamı ya da 90 dakika başına. */
export const H2H_MODES = ["TOTAL", "PER90"] as const;
export type H2HMode = (typeof H2H_MODES)[number];

export type H2HPosition = "FWD" | "MID" | "DEF" | "GK";

/** İstatistik havuzu (veri varsa). Maç ve dakika satır değil, oyuncunun künyesidir. */
export const H2H_STAT_KEYS = [
  "goals",
  "assists",
  "xg",
  "xa",
  "shots",
  "shotsOnTarget",
  "bigChancesCreated",
  "keyPasses",
  "passAccuracy",
  "dribbles",
  "duelsWonPct",
  "interceptions",
  "tackles",
  "rating",
  "saves",
] as const;
export type H2HStatKey = (typeof H2H_STAT_KEYS)[number];

export type H2HGroup = "HÜCUM" | "YARATICILIK" | "PAS" | "TOP KAZANMA" | "KALECİLİK";

export type H2HSource = "api-football" | "sportmonks";

/** Bir oyuncunun seçilen kapsamdaki sezon verisi — değerler TOPLAM (yüzde ve puan hariç). */
export interface PlayerSeasonStats {
  playerId: number;
  /** Kartta yazan tam ad ("Dušan Vlahović") ve kısa ad (olgu satırı: "Vlahović"). */
  fullName: string;
  shortName: string;
  /** Uluslararası mı Türkçe mi büyük harf (bkz. `name-case.ts`). */
  nameOrigin: "tr" | "intl" | null;
  teamId: number;
  teamName: string;
  /** Takım adının büyük harf kökeni (takımın ülkesinden). */
  teamOrigin: "tr" | "intl" | null;
  teamLogo: string | null;
  position: H2HPosition;
  season: number;
  /** "2026/27" */
  seasonLabel: string;
  scope: H2HScope;
  /** Takımın bu sezonki yurt içi ligi: kısa ad ("Süper Lig") ve kartta yazan büyük harfi ("SÜPER LİG", "SERIE A"). */
  league: { id: number; name: string; label: string };
  /** Kapsamdaki turnuvalar (API-Football kimliği + kartta yazan ad). */
  competitions: { id: number; name: string }[];
  appearances: number;
  minutes: number;
  values: Partial<Record<H2HStatKey, number>>;
  /** Değerin hangi sağlayıcıdan geldiği (rapor + dipnot). */
  sources: Partial<Record<H2HStatKey, H2HSource>>;
  /** Penaltı golü — bilinmiyorsa null (künyede yazılmaz). */
  penaltyGoals: number | null;
  /** Verinin kaynağı ve güncelliği — kaynaklar satır bazında KARIŞMAZ (kurucu kararı, 2026-10-27). */
  freshness: H2HFreshness;
}

export interface H2HFreshness {
  /**
   * Bütün satırların kaynağı: API-Football (sezon toplamı + toplama girmemiş maçlar maç bazlı veriden)
   * ya da — bu yapılamazsa — Sportmonks (tüm satırlar).
   */
  source: H2HSource;
  /** Verinin güncel olduğu son maçın başlama zamanı (takımın kapsamdaki son bitmiş maçı); bilinmiyorsa null. */
  asOfUtc: string | null;
  /** Sezon toplamına maç bazlı veriden eklenen maç sayısı (API-Football yolunda). */
  addedMatches: number;
  /** Sportmonks'a neden geçildi ya da neden tarih bilinmiyor; yoksa null. */
  note: string | null;
}

export interface H2HRow {
  key: H2HStatKey;
  label: string;
  group: H2HGroup;
  left: number;
  right: number;
  /** Kartta yazan değer ("0,52", "%78", "8,00"). */
  leftText: string;
  rightText: string;
  winner: "LEFT" | "RIGHT" | "TIE";
}

/** Satırı düşen istatistikler ve nedeni (rapor + stüdyo). */
export interface H2HDropped {
  key: H2HStatKey;
  reason: "MISSING_LEFT" | "MISSING_RIGHT" | "MISSING_BOTH" | "OVERFLOW";
}

export interface H2HPlayerCard {
  /** Büyük ad (Anton) — büyük harf, köken kuralıyla. */
  name: string;
  /** Ad satırının üstündeki küçük ilk ad; yoksa boş. */
  firstName: string;
  /** "TRABZONSPOR · FORVET" */
  subtitle: string;
  /** "8 MAÇ · 648 DK" */
  sampleLine: string;
  teamLogo: string | null;
  hex: string;
  /** Karşılaştırma sayfasının yüz fotoğrafı (data URI); yoksa logo. */
  face: string | null;
}

export interface H2HCard {
  pageLabels: [string, string];
  /** Sağ üst: maç tarihi ya da sezon. */
  dateLabel: string;
  accentHex: string;
  left: H2HPlayerCard;
  right: H2HPlayerCard;
  /** "SEZON TOPLAMI" / "90 DAKİKA BAŞINA" — kahramanların üstünde ve dipnotta. */
  modeLabel: string;
  hero: H2HRow[];
  /** Kahraman GOL satırının alt etiketi: "PENALTI 1 – 2"; bilinmiyorsa boş. */
  goalNote: string;
  rows: H2HRow[];
  /** Tek satır olgu (kural tabanlı); kural yoksa boş. */
  fact: string;
  /** Künye: "2026/27 · SÜPER LİG" + (varsa) "TRABZONSPOR – BEŞİKTAŞ · 01.11.2026". */
  scopeLabel: string;
  matchLabel: string;
  /** Dipnot satırları (xG/xA açıklaması, kaynak, 90 dk notu). */
  footnotes: string[];
  brandLogo: string;
}
