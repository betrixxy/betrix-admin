import { formatNumber } from "@/lib/format/number";
import type { H2HGroup, H2HMode, H2HPosition, H2HStatKey } from "@/types/player-h2h";

/**
 * Oyuncu karşılaştırmasının istatistik havuzu ve mevki öncelikleri — saf, TEK KAYNAK. Kahramanlar ve
 * kelebek satırları bu listelerden seçilir; veri yoksa satır düşer, sıradaki gelir (0 yazılmaz).
 * Bütün istatistiklerde büyük olan iyidir.
 */

/** count: sayı (90 dk başına çevrilir) · pct: yüzde · rating: ortalama puan · xg: beklenen değer (sayı gibi çevrilir). */
export type StatKind = "count" | "pct" | "rating" | "xg";

export interface StatMeta {
  label: string;
  /** Kahramanda kısa etiket. */
  short: string;
  group: H2HGroup;
  kind: StatKind;
}

export const STAT_META: Record<H2HStatKey, StatMeta> = {
  goals: { label: "Gol", short: "GOL", group: "HÜCUM", kind: "count" },
  xg: { label: "xG", short: "xG", group: "HÜCUM", kind: "xg" },
  shots: { label: "Şut", short: "ŞUT", group: "HÜCUM", kind: "count" },
  shotsOnTarget: { label: "İsabetli şut", short: "İSABETLİ ŞUT", group: "HÜCUM", kind: "count" },
  assists: { label: "Asist", short: "ASİST", group: "YARATICILIK", kind: "count" },
  xa: { label: "xA", short: "xA", group: "YARATICILIK", kind: "xg" },
  bigChancesCreated: { label: "Büyük fırsat yaratma", short: "BÜYÜK FIRSAT", group: "YARATICILIK", kind: "count" },
  keyPasses: { label: "Kilit pas", short: "KİLİT PAS", group: "YARATICILIK", kind: "count" },
  dribbles: { label: "Başarılı dripling", short: "DRİPLİNG", group: "YARATICILIK", kind: "count" },
  passAccuracy: { label: "Pas isabeti", short: "PAS İSABETİ", group: "PAS", kind: "pct" },
  duelsWonPct: { label: "Kazanılan ikili mücadele", short: "İKİLİ MÜCADELE", group: "TOP KAZANMA", kind: "pct" },
  interceptions: { label: "Top kesme", short: "TOP KESME", group: "TOP KAZANMA", kind: "count" },
  tackles: { label: "Top çalma", short: "TOP ÇALMA", group: "TOP KAZANMA", kind: "count" },
  rating: { label: "Ortalama puan", short: "PUAN", group: "PAS", kind: "rating" },
  saves: { label: "Kurtarış", short: "KURTARIŞ", group: "KALECİLİK", kind: "count" },
};

/** Kelebek grafiğinde grupların sırası. */
export const GROUP_ORDER: readonly H2HGroup[] = ["KALECİLİK", "HÜCUM", "YARATICILIK", "PAS", "TOP KAZANMA"];

/**
 * Mevkiye göre öncelik (kelebek tablosu): listenin başı en önemli. Satır sınırı aşılınca SONDAN düşer.
 * Ortalama puan tabloda YOK — 2. sayfada oyuncu adının altındaki künyede ("9 MAÇ · 734 DK · PUAN 7,86").
 */
export const POSITION_PRIORITY: Record<H2HPosition, readonly H2HStatKey[]> = {
  FWD: ["goals", "xg", "assists", "shots", "shotsOnTarget", "bigChancesCreated", "xa", "keyPasses", "dribbles", "duelsWonPct", "passAccuracy", "tackles", "interceptions"],
  MID: ["assists", "keyPasses", "bigChancesCreated", "xa", "goals", "xg", "passAccuracy", "dribbles", "shots", "shotsOnTarget", "duelsWonPct", "tackles", "interceptions"],
  DEF: ["duelsWonPct", "interceptions", "tackles", "passAccuracy", "keyPasses", "assists", "goals", "dribbles", "bigChancesCreated", "xg", "shots", "xa", "shotsOnTarget"],
  GK: ["saves", "passAccuracy", "duelsWonPct", "interceptions", "tackles"],
};

/** Posterin 3 kahraman istatistiği: listedeki ilk 3 (iki oyuncuda da olan). */
export const HERO_PRIORITY: Record<H2HPosition, readonly H2HStatKey[]> = {
  FWD: ["goals", "assists", "xg", "shots", "shotsOnTarget", "keyPasses"],
  MID: ["assists", "keyPasses", "bigChancesCreated", "goals", "passAccuracy", "dribbles"],
  DEF: ["duelsWonPct", "interceptions", "tackles", "passAccuracy", "rating"],
  GK: ["saves", "rating", "passAccuracy"],
};

export const POSITION_LABELS: Record<H2HPosition, string> = { FWD: "Forvet", MID: "Orta saha", DEF: "Defans", GK: "Kaleci" };

/** API-Football `games.position` → mevki. */
export function positionFromApi(value: string | null | undefined): H2HPosition | null {
  switch (value) {
    case "Attacker":
      return "FWD";
    case "Midfielder":
      return "MID";
    case "Defender":
      return "DEF";
    case "Goalkeeper":
      return "GK";
    default:
      return null;
  }
}

/** Satırlar 12–14 arası; format sınırı daha azını taşıyabilir (bkz. geometri). */
export const MAX_ROWS = 14;
/** Dakika farkı bundan büyükse varsayılan 90 dk başına. */
export const PER90_DEFAULT_GAP = 0.25;
/** Bu dakikanın altı "küçük örneklem". */
export const SMALL_SAMPLE_MINUTES = 270;

/** Varsayılan adalet: dakikalar arasında %25'ten fazla fark (büyüğe göre) → 90 dk başına. */
export function defaultMode(leftMinutes: number, rightMinutes: number): H2HMode {
  const high = Math.max(leftMinutes, rightMinutes);
  if (high <= 0) return "TOTAL";
  return Math.abs(leftMinutes - rightMinutes) / high > PER90_DEFAULT_GAP ? "PER90" : "TOTAL";
}

/** Kartta kullanılan değer: sayı ve xG 90 dk başına çevrilir; yüzde ve puan aynen. */
export function modeValue(key: H2HStatKey, total: number, minutes: number, mode: H2HMode): number | null {
  const { kind } = STAT_META[key];
  if (mode === "TOTAL" || kind === "pct" || kind === "rating") return total;
  return minutes > 0 ? (total * 90) / minutes : null;
}

const decimal = (value: number, digits: number) => formatNumber(value, { decimals: digits });

/** Türkçe yazım: ondalık virgül, yüzde işareti önde ("%78"). */
export function formatStat(key: H2HStatKey, value: number, mode: H2HMode): string {
  const { kind } = STAT_META[key];
  // Gerçek 0 her modda "0" ("0,00" değil).
  if (value === 0 && kind !== "pct") return "0";
  if (kind === "pct") return `%${Math.round(value)}`;
  if (kind === "rating") return decimal(value, 2);
  if (kind === "xg") return decimal(value, 2);
  return mode === "PER90" ? decimal(value, 2) : String(Math.round(value));
}
