import type { ApiFootballPlayerSeasonEntry } from "@/lib/services/api-football/player-season-types";
import type { H2HStatKey } from "@/types/player-h2h";

/**
 * Oyuncu sezon kayıtlarını (takım × turnuva) tek kapsamda toplar — saf. KATI kural: kapsamdaki
 * kayıtlardan birinde bir alan `null` ise o istatistiğin toplamı BİLİNMİYOR sayılır (eksik toplam
 * yazılmaz). Yüzdeler ağırlıklı (pas isabeti → pas sayısı, puan → maç), ikili mücadele toplamlardan.
 * Dakikası olmayan kayıt (yedekte kalınan turnuva) yok sayılır.
 */

export interface SeasonAggregate {
  appearances: number;
  minutes: number;
  values: Partial<Record<H2HStatKey, number>>;
  penaltyGoals: number | null;
  /** En çok dakika alınan kaydın mevkisi ("Attacker"…). */
  position: string | null;
  competitions: { id: number; name: string }[];
}

type Entry = ApiFootballPlayerSeasonEntry;
type Read = (entry: Entry) => number | null | undefined;

const num = (value: number | string | null | undefined): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
};

/** Toplam; kayıtlardan birinde değer yoksa undefined. */
function strictSum(entries: Entry[], read: Read): number | undefined {
  let total = 0;
  for (const entry of entries) {
    const value = read(entry);
    if (value === null || value === undefined) return undefined;
    total += value;
  }
  return entries.length ? total : undefined;
}

/** Ağırlıklı ortalama; değer ya da ağırlık eksikse undefined, toplam ağırlık 0 ise undefined. */
function weighted(entries: Entry[], read: Read, weight: Read): number | undefined {
  let sum = 0;
  let weights = 0;
  for (const entry of entries) {
    const [value, w] = [read(entry), weight(entry)];
    if (value === null || value === undefined || w === null || w === undefined) return undefined;
    sum += value * w;
    weights += w;
  }
  return weights > 0 ? sum / weights : undefined;
}

const played = (entry: Entry) => (entry.games.minutes ?? 0) > 0;

/** Kapsamdaki kayıtları toplar: `filter` takım/turnuva/sezon seçimini yapar. */
export function aggregateSeason(entries: Entry[], filter: (entry: Entry) => boolean): SeasonAggregate {
  const scoped = entries.filter((entry) => filter(entry) && played(entry));
  const values: Partial<Record<H2HStatKey, number>> = {};
  const set = (key: H2HStatKey, value: number | undefined) => {
    if (value !== undefined) values[key] = value;
  };
  set("goals", strictSum(scoped, (e) => e.goals?.total));
  set("assists", strictSum(scoped, (e) => e.goals?.assists));
  set("shots", strictSum(scoped, (e) => e.shots?.total));
  set("shotsOnTarget", strictSum(scoped, (e) => e.shots?.on));
  set("keyPasses", strictSum(scoped, (e) => e.passes?.key));
  set("dribbles", strictSum(scoped, (e) => e.dribbles?.success));
  set("interceptions", strictSum(scoped, (e) => e.tackles?.interceptions));
  set("tackles", strictSum(scoped, (e) => e.tackles?.total));
  set("saves", strictSum(scoped, (e) => e.goals?.saves));
  set("passAccuracy", weighted(scoped, (e) => num(e.passes?.accuracy), (e) => e.passes?.total));
  set("rating", weighted(scoped, (e) => num(e.games.rating), (e) => e.games.appearences));
  const duelsTotal = strictSum(scoped, (e) => e.duels?.total);
  const duelsWon = strictSum(scoped, (e) => e.duels?.won);
  if (duelsTotal !== undefined && duelsWon !== undefined && duelsTotal > 0) values.duelsWonPct = (duelsWon / duelsTotal) * 100;

  const main = [...scoped].sort((a, b) => (b.games.minutes ?? 0) - (a.games.minutes ?? 0))[0];
  return {
    appearances: scoped.reduce((sum, e) => sum + (e.games.appearences ?? 0), 0),
    minutes: scoped.reduce((sum, e) => sum + (e.games.minutes ?? 0), 0),
    values,
    penaltyGoals: strictSum(scoped, (e) => e.penalty?.scored) ?? null,
    position: main?.games.position ?? null,
    competitions: scoped.map((e) => ({ id: e.league.id, name: e.league.name })),
  };
}

/** Kayıtlardaki güncel takım: sezonda en çok dakika alınan takım (transferde son kulüp değil — çağıran verir). */
export function mainTeam(entries: Entry[], season: number): { id: number; name: string; logo: string | null } | null {
  const minutes = new Map<number, { id: number; name: string; logo: string | null; minutes: number }>();
  for (const entry of entries) {
    if (entry.league.season !== season) continue;
    const current = minutes.get(entry.team.id) ?? { id: entry.team.id, name: entry.team.name, logo: entry.team.logo ?? null, minutes: 0 };
    current.minutes += entry.games.minutes ?? 0;
    minutes.set(entry.team.id, current);
  }
  const best = [...minutes.values()].sort((a, b) => b.minutes - a.minutes)[0];
  return best ? { id: best.id, name: best.name, logo: best.logo } : null;
}
