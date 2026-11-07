/**
 * "Canlı taktik tahtası" formatı (2026-11-07): tek kalıcı saha, sahneler "beat". Her beat bir kamera durumu ve bir üst katman
 * getirir; geçiş sert kesim değil, kamera 12–18 karede yumuşakça döner. Bütün rakamlar senaryo kurucusunda snapshot'tan gelir,
 * bileşen rakam üretmez.
 */

export interface Camera {
  /** Sahanın öne eğimi (derece). */
  tilt: number;
  zoom: number;
  /** Ekran pikseli. */
  panX: number;
  panY: number;
  /** Z ekseni dönüşü (derece). */
  rotate: number;
}

export type Side = "home" | "away";

export interface TacticalPlayer {
  id: number;
  /** Kart adı: soyad. */
  name: string;
  number: number | null;
  /** API-Football `grid` "hat:sütun" (hat 1 = kaleci). */
  line: number;
  column: number;
  lines: number;
  columns: number;
  /** Sakat/cezalı: nokta grileşir + kırmızı çarpı. */
  out: boolean;
}

export interface TacticalTeam {
  name: string;
  /** Dar yerler (bant, etiket). */
  short: string;
  logo: string;
  primary: string;
  secondary: string;
  formation: string;
  players: TacticalPlayer[];
}

export type BeatKind = "hook" | "outcome" | "goals" | "both" | "first" | "why" | "duel" | "upset" | "close";

export interface Beat {
  kind: BeatKind;
  /** Küçük üst etiket: SİMÜLASYON / GOL / KADRO / FORM / DÜELLO / SÜRPRİZ. */
  tag: string;
  title: string;
  from: number;
  duration: number;
  camera: Camera;
  /** Beat'e özgü, snapshot'tan hazırlanmış değerler. */
  values: Record<string, number | string>;
}

export interface SpokenWord {
  text: string;
  /** Mutlak kare. */
  start: number;
  end: number;
  beat: number;
}

export interface TacticalScript {
  durationInFrames: number;
  simulations: number;
  kickoffLabel: string;
  competitionLabel: string;
  /** Tam adres: "www.checkmatch.net" (Instagram adı yazılmaz, kullanıcı 2026-11-07). */
  site: string;
  legal: string;
  /** Kapak: "7 KASIM CUMARTESİ · 19:00" (İstanbul saati). */
  dateLabel: string;
  /** Kapak: stadyum adı; yoksa satır çizilmez. */
  venue: string | null;
  /** Bulanık stadyum zemini; yoksa koyu çim dokusu. */
  backdrop: string | null;
  home: TacticalTeam;
  away: TacticalTeam;
  beats: Beat[];
  words: SpokenWord[];
}
