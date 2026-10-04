/** Maç Günü kartı tasarım şablonları — her biri kendi yerleşimini, tipografisini ve AI arka plan stilini taşır. */
export const MATCH_DAY_TEMPLATE_IDS = ["PREMIUM_BROADCAST", "DATA_DRIVEN", "EDITORIAL_PORTRAIT"] as const;
export type MatchDayTemplateId = (typeof MATCH_DAY_TEMPLATE_IDS)[number];

/** Platform formatları (bkz. CLAUDE.md 3.3) — her şablon her formatta kendi yerleşimini kurar. */
export const MATCH_DAY_FORMAT_IDS = ["IG_PORTRAIT", "IG_SQUARE", "STORY", "X_LANDSCAPE"] as const;
export type MatchDayFormatId = (typeof MATCH_DAY_FORMAT_IDS)[number];

/** Kalite modu: PREMIUM AI harmanlama (image-to-image) yapar; ECONOMY bu ücretli adımı atlar. */
export const MATCH_DAY_QUALITY_MODES = ["PREMIUM", "ECONOMY"] as const;
export type MatchDayQualityMode = (typeof MATCH_DAY_QUALITY_MODES)[number];

/** "Data Driven" şablonunun kullandığı gerçek veri özeti (API-Football); olmayan metrik `null`. */
export interface MatchDayStats {
  homeForm: ("W" | "D" | "L")[];
  awayForm: ("W" | "D" | "L")[];
  homeGoalsForAvg: number | null;
  awayGoalsForAvg: number | null;
  homeGoalsAgainstAvg: number | null;
  awayGoalsAgainstAvg: number | null;
  h2h: { played: number; homeWins: number; draws: number; awayWins: number };
}

/** `/api/og/match-day` için doğrulanmış (ham) URL parametreleri — görseller henüz çözülmemiştir. */
export interface MatchDayParams {
  homeTeam: string;
  awayTeam: string;
  league?: string | undefined;
  week?: string | undefined;
  date?: string | undefined;
  time?: string | undefined;
  stadium?: string | undefined;
  referee?: string | undefined;
  /** Lig logosu (API-Football CDN). */
  leagueLogo?: string | undefined;
  /** `/api/files/<kova>/<dosya>` (yerel depolama) veya mutlak `http(s)://` adresi. */
  homePlayerImg?: string | undefined;
  awayPlayerImg?: string | undefined;
  homeLogo?: string | undefined;
  awayLogo?: string | undefined;
}

/** Şablona giden, metinleri biçimlenmiş ve görselleri `data:` URI'ye çözülmüş kart verisi. */
export interface MatchDayCard {
  /** Büyük harfli (tr-TR) adlar — display fontlu şablonlar için. */
  homeTeam: string;
  awayTeam: string;
  /** Kullanıcının yazdığı haliyle adlar — serif/editoryal şablon için. */
  homeTeamName: string;
  awayTeamName: string;
  leagueLabel: string;
  /** Örn. "3. HAFTA"; verilmediyse `null` (satır hiç çizilmez). */
  weekLabel: string | null;
  dateLabel: string;
  /** "Pazartesi" — tarih yyyy-MM-dd verildiyse; aksi halde null. */
  weekdayLabel: string | null;
  timeLabel: string;
  stadiumLabel: string;
  refereeLabel: string;
  /** Görsel çözülemezse `null` — şablon bunun yerine düz renk/baş harf çizer, render düşmez. */
  homePlayerImg: string | null;
  awayPlayerImg: string | null;
  homeLogo: string | null;
  awayLogo: string | null;
  brandLogo: string;
  leagueLogo: string | null;
  /** Takım renkleri — vurgu çizgileri, veri kutuları. */
  homeColorHex: string;
  awayColorHex: string;
  /** Yalnızca veri odaklı şablonda doldurulur; çekilemezse `null` (şablon künye kutularına düşer). */
  stats: MatchDayStats | null;
}

/** Maç Günü üreticisinde seçilebilen maç — seçilince formdaki alanları otomatik doldurur. */
export interface MatchDayFixtureOption {
  id: string;
  label: string;
  homeTeam: string;
  awayTeam: string;
  /** API-Football logo URL'leri (media.api-sports.io). */
  homeLogoUrl: string;
  awayLogoUrl: string;
  /** Lig logosu; sağlayıcı vermediyse boş. */
  leagueLogoUrl: string;
  league: string;
  /** Ör. "3" (lig haftası) veya ham tur etiketi; bilinmiyorsa boş. */
  week: string;
  /** yyyy-MM-dd, Europe/Istanbul */
  date: string;
  /** HH:mm, Europe/Istanbul */
  time: string;
  stadium: string;
  referee: string;
}

export interface MatchDayGenerationResult {
  id: string;
  resultImageUrl: string;
  /** Ara katmanlar — inceleme/hata ayıklama için arayüzde küçük önizleme olarak gösterilir. */
  backgroundImageUrl: string;
  compositeImageUrl: string;
  prompt: string;
  /** Kullanılan tasarım şablonu (rastgele seçildiyse sunucunun atadığı). */
  template: MatchDayTemplateId;
  format: MatchDayFormatId;
  /** Bu üretimde yapılan ücretli Fal.ai çağrısı sayısı ve önbellekten/atlanarak tasarruf edilen adımlar. */
  paidCalls: number;
  savedSteps: string[];
}

export interface MatchDayActionState {
  error?: string;
  result?: MatchDayGenerationResult;
}
