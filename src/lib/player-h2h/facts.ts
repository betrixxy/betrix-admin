import type { H2HMode, H2HPosition, H2HStatKey, PlayerSeasonStats } from "@/types/player-h2h";
import { modeValue } from "./stats";
import { genitive } from "./turkish";

/**
 * Posterin tek satır olgusu — kural tabanlı, yorum yok: ilk tutan kural yazılır, hiçbiri tutmazsa
 * satır yok. Her kural yalnızca iki oyuncuda da olan veriye bakar. Karşılaştırma seçilen adaletle
 * (toplam / 90 dk) yapılır; xG–gol farkı sezon toplamıyla.
 */

type Player = Pick<PlayerSeasonStats, "shortName" | "values" | "minutes">;

/** xG golü bu kadar aşarsa "xG'si golünden yüksek"; gol xG'yi bu kadar aşarsa tersi. */
export const XG_UNDER_GAP = 1;
export const XG_OVER_GAP = 1.5;

const value = (player: Player, key: H2HStatKey, mode: H2HMode) => {
  const total = player.values[key];
  return total === undefined ? null : modeValue(key, total, player.minutes, mode);
};

/** a, b'den hem `more`'da büyük hem `less`'te küçük mü (ikisi de biliniyorsa). */
function moreWithLess(a: Player, b: Player, more: H2HStatKey, less: H2HStatKey, mode: H2HMode): boolean {
  const [am, bm, al, bl] = [value(a, more, mode), value(b, more, mode), value(a, less, mode), value(b, less, mode)];
  return am !== null && bm !== null && al !== null && bl !== null && am > bm && al < bl;
}

function bothMore(a: Player, b: Player, keys: [H2HStatKey, H2HStatKey], mode: H2HMode): boolean {
  return keys.every((key) => {
    const [x, y] = [value(a, key, mode), value(b, key, mode)];
    return x !== null && y !== null && x > y;
  });
}

type Rule = (a: Player, b: Player, mode: H2HMode) => string | null;

const fewerShotsMoreGoals: Rule = (a, b, mode) =>
  moreWithLess(a, b, "goals", "shots", mode) ? (mode === "PER90" ? `${a.shortName} 90 dakikada daha az şutla daha çok gol buluyor` : `${a.shortName} daha az şutla daha çok gol attı`) : null;

const fewerMinutesMoreGoals: Rule = (a, b, mode) => {
  if (mode !== "TOTAL") return null;
  const [ag, bg] = [a.values.goals, b.values.goals];
  return ag !== undefined && bg !== undefined && ag > bg && a.minutes < b.minutes ? `${a.shortName} daha az dakikada daha çok gol attı` : null;
};

const xgUnder: Rule = (a) => {
  const [xg, goals] = [a.values.xg, a.values.goals];
  return xg !== undefined && goals !== undefined && xg - goals >= XG_UNDER_GAP ? `${genitive(a.shortName)} xG'si golünden yüksek` : null;
};

const xgOver: Rule = (a) => {
  const [xg, goals] = [a.values.xg, a.values.goals];
  return xg !== undefined && goals !== undefined && goals - xg >= XG_OVER_GAP ? `${genitive(a.shortName)} golü xG'sinden yüksek` : null;
};

const assistsAndKeyPasses: Rule = (a, b, mode) => (bothMore(a, b, ["assists", "keyPasses"], mode) ? `${a.shortName} hem daha çok asist yaptı hem daha çok kilit pas verdi` : null);
const interceptionsAndTackles: Rule = (a, b, mode) => (bothMore(a, b, ["interceptions", "tackles"], mode) ? `${a.shortName} hem daha çok top kesti hem daha çok top çaldı` : null);
const moreSaves: Rule = (a, b, mode) => {
  const [x, y] = [value(a, "saves", mode), value(b, "saves", mode)];
  return x !== null && y !== null && x > y ? `${a.shortName} daha çok kurtarış yaptı` : null;
};

/** Mevkiye göre kural sırası. */
const RULES: Record<H2HPosition, Rule[]> = {
  FWD: [fewerShotsMoreGoals, fewerMinutesMoreGoals, xgUnder, xgOver, assistsAndKeyPasses],
  MID: [assistsAndKeyPasses, fewerShotsMoreGoals, xgUnder, xgOver],
  DEF: [interceptionsAndTackles, assistsAndKeyPasses],
  GK: [moreSaves],
};

/** İlk tutan kural (önce sol oyuncu, sonra sağ); yoksa boş metin. */
export function factLine(left: Player, right: Player, position: H2HPosition, mode: H2HMode): string {
  for (const rule of RULES[position]) {
    const line = rule(left, right, mode) ?? rule(right, left, mode);
    if (line) return line;
  }
  return "";
}
