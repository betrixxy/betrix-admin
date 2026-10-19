import type { Fixture } from "@/types/sports";

/**
 * Vitrin zaman kapısı (kurucu kararı, 2026-10-19): maç önü tahmin yalnızca BAŞLAMAMIŞ maç için
 * üretilir ve kayda geçer. Stüdyo (yükleme, AI gerekçe, önizleme, kayıt) ve onay aynı kuralı okur;
 * tahmin kaydının anı kickoff'tan önce olmak zorundadır (onay anı < kickoff). Offline tasarım aracı
 * (`scripts/render-vitrin.ts --allow-past`) dışında istisna yok; o araç kayıt yazmaz.
 */

/** Saf: maç başlamamış ve hâlâ planlı ise null, değilse okunur sebep. */
export function kickoffGate(fixture: Pick<Fixture, "kickoffUtc" | "status">, now: Date): string | null {
  const kickoff = Date.parse(fixture.kickoffUtc);
  if (!Number.isFinite(kickoff)) return "Maçın başlama saati okunamadı — vitrin üretilmez.";
  if (now.getTime() >= kickoff) return `Maç başladı (${fixture.kickoffUtc}) — vitrin yalnızca başlamamış maçlar için üretilir ve onaylanır.`;
  if (fixture.status !== "SCHEDULED") return `Maç planlı değil (${fixture.status}) — vitrin üretilmez.`;
  return null;
}
