import { seeded } from "./motion";

/**
 * Monte Carlo kartının yakınsama çizgileri. GÖSTERİMDİR: tek tek simülasyonun kaydı değildir, veride bu yol yok. Yalnız uç
 * nokta veridir (son nokta birebir nihai yüzde). Dalga başta geniş, simülasyon arttıkça daralır; rakam okunmaz, biçim okunur.
 */

export type Outcome3 = { home: number; draw: number; away: number };

/** Sayaç bu eşiğe gelmeden yüzde yazılmaz: az maçla oran anlamsız. */
export const PERCENT_THRESHOLD = 2000;
const AMPLITUDE = 13;
const KNOTS = 14;

const wave = (t: number, seed: number): number => {
  const at = t * KNOTS;
  const low = Math.floor(at);
  const mix = at - low;
  const smooth = mix * mix * (3 - 2 * mix);
  const knot = (index: number) => seeded(index * 13 + seed) * 2 - 1;
  return knot(low) * (1 - smooth) + knot(low + 1) * smooth;
};

/** t: kartın akış ilerlemesi, 0–1. Toplam her zaman 100, t = 1'de birebir nihai. */
export function convergedAt(final: Outcome3, t: number): Outcome3 {
  const spread = AMPLITUDE * Math.max(0, 1 - t) ** 1.1;
  const home = Math.max(1, Math.min(98, final.home + wave(t, 3) * spread));
  const draw = Math.max(1, Math.min(99 - home, final.draw + wave(t, 41) * spread * 0.7));
  return { home: t >= 1 ? final.home : home, draw: t >= 1 ? final.draw : draw, away: t >= 1 ? final.away : 100 - home - draw };
}

/** Ekranda tam sayı; toplam 100 korunur. */
export function roundedAt(final: Outcome3, t: number): Outcome3 {
  const exact = convergedAt(final, t);
  const home = Math.round(exact.home);
  const draw = Math.round(exact.draw);
  return { home, draw, away: 100 - home - draw };
}

/** Kazanma ihtimali en yüksek taraf; eşitse null. Beraberlik "taraf" değildir. */
export const winLeader = (final: Outcome3): "home" | "away" | null => (final.home === final.away ? null : final.home > final.away ? "home" : "away");

/** Sayaç yüzdeyi gösterebilir mi: `simulations` eşikten küçükse son karede. */
export const percentVisible = (played: number, simulations: number): boolean => played >= Math.min(PERCENT_THRESHOLD, simulations);
