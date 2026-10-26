import type { H2HDropped, H2HMode, H2HPosition, H2HRow, H2HStatKey, PlayerSeasonStats } from "@/types/player-h2h";
import { formatStat, GROUP_ORDER, HERO_PRIORITY, MAX_ROWS, modeValue, POSITION_PRIORITY, STAT_META } from "./stats";

/**
 * Kelebek satırları ve kahramanlar — saf. Kurallar:
 *  - Bir istatistik İKİ oyuncuda da yoksa ya da yalnızca birinde yoksa satır ikisinde de düşer
 *    (0 yazılmaz, uydurulmaz); öncelik listesinde sıradaki gelir.
 *  - Satır sınırı aşılırsa en düşük öncelikli satırlar düşer; kalanlar grup sırasına dizilir.
 *  - Kazanan, KARTTA YAZAN değerle belirlenir: yazılan iki değer aynıysa berabere.
 */

type Side = Pick<PlayerSeasonStats, "values" | "minutes">;

function row(key: H2HStatKey, left: Side, right: Side, mode: H2HMode): H2HRow | null {
  const leftTotal = left.values[key];
  const rightTotal = right.values[key];
  if (leftTotal === undefined || rightTotal === undefined) return null;
  const l = modeValue(key, leftTotal, left.minutes, mode);
  const r = modeValue(key, rightTotal, right.minutes, mode);
  if (l === null || r === null) return null;
  const leftText = formatStat(key, l, mode);
  const rightText = formatStat(key, r, mode);
  const winner = leftText === rightText ? "TIE" : l > r ? "LEFT" : "RIGHT";
  return { key, label: STAT_META[key].label, group: STAT_META[key].group, left: l, right: r, leftText, rightText, winner };
}

function missing(key: H2HStatKey, left: Side, right: Side): H2HDropped["reason"] | null {
  const l = left.values[key] === undefined;
  const r = right.values[key] === undefined;
  if (l && r) return "MISSING_BOTH";
  if (l) return "MISSING_LEFT";
  if (r) return "MISSING_RIGHT";
  return null;
}

export interface RowsResult {
  rows: H2HRow[];
  dropped: H2HDropped[];
}

/** Mevki önceliğine göre satırlar (en fazla `maxRows`), grup sırasına dizilmiş. */
export function buildRows(left: Side, right: Side, position: H2HPosition, mode: H2HMode, maxRows = MAX_ROWS): RowsResult {
  const dropped: H2HDropped[] = [];
  const available: H2HRow[] = [];
  for (const key of POSITION_PRIORITY[position]) {
    const reason = missing(key, left, right);
    const built = reason ? null : row(key, left, right, mode);
    if (!built) {
      dropped.push({ key, reason: reason ?? "MISSING_BOTH" });
      continue;
    }
    if (available.length >= maxRows) dropped.push({ key, reason: "OVERFLOW" });
    else available.push(built);
  }
  const rank = (r: H2HRow) => POSITION_PRIORITY[position].indexOf(r.key);
  const rows = [...available].sort((a, b) => GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group) || rank(a) - rank(b));
  return { rows, dropped };
}

/** Posterin 3 kahraman istatistiği: mevkinin kahraman listesinden iki oyuncuda da olan ilk üçü. */
export function buildHero(left: Side, right: Side, position: H2HPosition, mode: H2HMode): H2HRow[] {
  const hero: H2HRow[] = [];
  for (const key of [...HERO_PRIORITY[position], ...POSITION_PRIORITY[position]]) {
    if (hero.length === 3) break;
    if (hero.some((entry) => entry.key === key)) continue;
    const built = row(key, left, right, mode);
    if (built) hero.push(built);
  }
  return hero;
}

/** Satırları gruplar (kelebek grafiğinin başlıkları), grup sırası korunur. */
export function groupRows(rows: H2HRow[]): { group: H2HRow["group"]; rows: H2HRow[] }[] {
  return GROUP_ORDER.flatMap((group) => {
    const inGroup = rows.filter((entry) => entry.group === group);
    return inGroup.length ? [{ group, rows: inGroup }] : [];
  });
}
