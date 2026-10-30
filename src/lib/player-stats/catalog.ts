import { formatNumber } from "@/lib/format/number";
import type { PlayerMatchLine, PlayerPosition, PlayerStatKey, PlayerStatRow, PlayerStatSource } from "@/types/player-match-stats";

/**
 * Oyuncu İstatistikleri satır kataloğu (saf). Her satır API-Football maç verisinden okunur; tek istisna xG
 * (Sportmonks, dakika birebir tutuyorsa — `xg.ts`). API-Football'un hiç vermediği satırlar (büyük fırsat,
 * dokunuş, top kazanma, top uzaklaştırma, hava topu, kale çizgisi dışı müdahale) burada `null` okunur:
 * mevki listesinde yerleri durur, kartta düşer, yedekten sıradaki gelir. Kaynaklar satır içinde karışmaz.
 */

type Reading = { value: string; short: string; zero: boolean } | null;

const count = (value: number | null, short: (text: string) => string): Reading =>
  value === null ? null : { value: String(value), short: short(String(value)), zero: value === 0 };

const percent = (part: number | null, total: number | null, short: string): Reading => {
  if (part === null || total === null || total <= 0 || part > total) return null;
  const pct = Math.round((part / total) * 100);
  return { value: `%${pct}`, short: `%${pct} ${short}`, zero: pct === 0 };
};

/** "3/4" — hiç deneme yoksa (0/0) satır anlamsızdır, yazılmaz. */
const pair = (made: number | null, total: number | null, short: string): Reading => {
  if (made === null || total === null || total <= 0 || made > total) return null;
  return { value: `${made}/${total}`, short: `${made}/${total} ${short}`, zero: made === 0 };
};

interface StatDef {
  label: string;
  source: PlayerStatSource;
  read: (line: PlayerMatchLine) => Reading;
}

/** API-Football maç ucunda olmayan satır. */
const UNAVAILABLE = (): Reading => null;

export const PLAYER_STAT_DEFS: Record<PlayerStatKey, StatDef> = {
  goals: { label: "GOL", source: "API_FOOTBALL", read: (l) => count(l.numbers.goals, (v) => `${v} gol`) },
  assists: { label: "ASİST", source: "API_FOOTBALL", read: (l) => count(l.numbers.assists, (v) => `${v} asist`) },
  shots: { label: "İSABETLİ ŞUT / ŞUT", source: "API_FOOTBALL", read: (l) => pair(l.numbers.shotsOn, l.numbers.shotsTotal, "isabetli şut") },
  xg: {
    label: "xG",
    source: "SPORTMONKS",
    read: (l) => (l.xg === null ? null : { value: formatNumber(l.xg, { decimals: 2 }), short: `${formatNumber(l.xg, { decimals: 2 })} xG`, zero: l.xg === 0 }),
  },
  bigChances: { label: "BÜYÜK FIRSAT", source: "API_FOOTBALL", read: UNAVAILABLE },
  dribbles: {
    label: "BAŞARILI DRİPLİNG",
    source: "API_FOOTBALL",
    read: (l) => (l.numbers.dribblesAttempts === null ? count(l.numbers.dribblesSuccess, (v) => `${v} başarılı dripling`) : pair(l.numbers.dribblesSuccess, l.numbers.dribblesAttempts, "dripling")),
  },
  keyPasses: { label: "KİLİT PAS", source: "API_FOOTBALL", read: (l) => count(l.numbers.keyPasses, (v) => `${v} kilit pas`) },
  touches: { label: "DOKUNUŞ", source: "API_FOOTBALL", read: UNAVAILABLE },
  passAccuracy: { label: "PAS İSABETİ", source: "API_FOOTBALL", read: (l) => percent(l.numbers.passesAccurate, l.numbers.passesTotal, "pas isabeti") },
  duels: { label: "İKİLİ MÜCADELE", source: "API_FOOTBALL", read: (l) => percent(l.numbers.duelsWon, l.numbers.duelsTotal, "ikili mücadele") },
  recoveries: { label: "TOP KAZANMA", source: "API_FOOTBALL", read: UNAVAILABLE },
  interceptions: { label: "TOP KESME", source: "API_FOOTBALL", read: (l) => count(l.numbers.interceptions, (v) => `${v} top kesme`) },
  clearances: { label: "TOP UZAKLAŞTIRMA", source: "API_FOOTBALL", read: UNAVAILABLE },
  aerials: { label: "HAVA TOPU", source: "API_FOOTBALL", read: UNAVAILABLE },
  blocks: { label: "BLOK", source: "API_FOOTBALL", read: (l) => count(l.numbers.blocks, (v) => `${v} blok`) },
  saves: { label: "KURTARIŞ", source: "API_FOOTBALL", read: (l) => count(l.numbers.saves, (v) => `${v} kurtarış`) },
  conceded: { label: "YENİLEN GOL", source: "API_FOOTBALL", read: (l) => count(l.numbers.conceded, (v) => `${v} yenilen gol`) },
  // Penaltı kurtarışı yalnızca olduysa yazılır: "0 kurtarılan penaltı" penaltı yokken anlamsızdır.
  penaltySaved: {
    label: "KURTARILAN PENALTI",
    source: "API_FOOTBALL",
    read: (l) => (l.numbers.penaltySaved ? count(l.numbers.penaltySaved, (v) => `${v} kurtarılan penaltı`) : null),
  },
  sweeper: { label: "KALE ÇİZGİSİ DIŞI MÜDAHALE", source: "API_FOOTBALL", read: UNAVAILABLE },
  tackles: { label: "TOP ÇALMA", source: "API_FOOTBALL", read: (l) => count(l.numbers.tackles, (v) => `${v} top çalma`) },
  passes: { label: "PAS", source: "API_FOOTBALL", read: (l) => count(l.numbers.passesTotal, (v) => `${v} pas`) },
  foulsDrawn: { label: "KAZANILAN FAUL", source: "API_FOOTBALL", read: (l) => count(l.numbers.foulsDrawn, (v) => `${v} kazanılan faul`) },
};

/** Mevki öncelik listesi (kurucu tanımı, 2026-10-30) + yedek: listedeki satır düşerse yedekten sıradaki gelir. */
export const POSITION_PRIORITY: Record<PlayerPosition, { priority: PlayerStatKey[]; reserve: PlayerStatKey[] }> = {
  F: { priority: ["goals", "assists", "shots", "xg", "bigChances", "dribbles", "keyPasses", "touches"], reserve: ["duels", "passAccuracy", "foulsDrawn", "interceptions", "tackles"] },
  M: { priority: ["assists", "keyPasses", "passAccuracy", "dribbles", "duels", "recoveries", "shots"], reserve: ["goals", "interceptions", "tackles", "passes", "foulsDrawn"] },
  D: { priority: ["interceptions", "clearances", "duels", "aerials", "passAccuracy", "blocks"], reserve: ["tackles", "goals", "assists", "keyPasses", "passes"] },
  G: { priority: ["saves", "conceded", "penaltySaved", "sweeper", "passAccuracy"], reserve: ["passes"] },
};

export const POSITION_LABELS: Record<PlayerPosition, string> = { G: "KALECİ", D: "DEFANS", M: "ORTA SAHA", F: "FORVET" };

/** Mevkisi bilinmeyen oyuncu orta saha listesiyle okunur. */
export const positionKeys = (position: PlayerPosition | null): PlayerStatKey[] => {
  const lists = POSITION_PRIORITY[position ?? "M"];
  return [...lists.priority, ...lists.reserve];
};

export function readStat(line: PlayerMatchLine, key: PlayerStatKey): PlayerStatRow | null {
  const def = PLAYER_STAT_DEFS[key];
  const reading = def.read(line);
  return reading ? { key, label: def.label, source: def.source, ...reading } : null;
}
