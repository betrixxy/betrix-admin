import type { MatchResultFacts, MatchResultTemplateId, MvpCandidate } from "@/types/match-result";

/**
 * Maç Sonucu kartında öne çıkan oyuncu yuvaları — saf, istemci de kullanır. Galibiyette (penaltıyla
 * kazanılan dahil) tek yuva: maçın oyuncusu, öneri kazanan takımın en yüksek rating'i, istenirse
 * iki takımdan herhangi bir oyuncu seçilebilir. Beraberlikte iki yuva (split varyant): her takımın
 * en yüksek rating'li oyuncusu; karttaki "MAÇIN OYUNCUSU" ikisinden rating'i yüksek olandır.
 */

export const PLAYER_SLOT_KEYS = ["player1", "player2"] as const;
export type PlayerSlotKey = (typeof PLAYER_SLOT_KEYS)[number];

export interface FeaturedSlot {
  key: PlayerSlotKey;
  label: string;
  options: MvpCandidate[];
  defaultPlayerId: number | null;
}

export function featuredSlots(facts: MatchResultFacts): FeaturedSlot[] {
  if (facts.outcome === "DRAW") {
    const side = (which: "HOME" | "AWAY") => facts.players.filter((player) => player.side === which);
    const home = side("HOME");
    const away = side("AWAY");
    return [
      { key: "player1", label: `${facts.home.name} oyuncusu (sol)`, options: home, defaultPlayerId: home[0]?.playerId ?? null },
      { key: "player2", label: `${facts.away.name} oyuncusu (sağ)`, options: away, defaultPlayerId: away[0]?.playerId ?? null },
    ];
  }
  // Kazanan takımın oyuncuları önce; sıra içinde rating'e göre (havuz zaten sıralı).
  const winnerFirst = [...facts.players].sort((a, b) => Number(b.side === facts.outcome) - Number(a.side === facts.outcome));
  return [{ key: "player1", label: "Maçın oyuncusu", options: winnerFirst, defaultPlayerId: facts.mvp?.playerId ?? winnerFirst[0]?.playerId ?? null }];
}

/** Seçilen oyunculardan karta yazılacak "maçın oyuncusu": tekse o, ikiyse rating'i (sonra golü) yüksek olan. */
export function mvpOf(selected: MvpCandidate[]): MvpCandidate | null {
  return selected.reduce<MvpCandidate | null>((best, candidate) => {
    if (!best) return candidate;
    const delta = (candidate.rating ?? 0) - (best.rating ?? 0) || candidate.goals - best.goals;
    return delta > 0 ? candidate : best;
  }, null);
}

export function playerOptionLabel(player: MvpCandidate, facts: Pick<MatchResultFacts, "home" | "away">): string {
  const team = player.side === "HOME" ? facts.home.name : facts.away.name;
  const parts = [player.name, team];
  if (player.rating !== null) parts.push(player.rating.toFixed(1));
  if (player.goals > 0) parts.push(`${player.goals} gol`);
  return parts.join(" · ");
}

/** Şablon kataloğu — şimdilik yalnızca kahraman-skor üretilir; diğerleri "Yakında". */
export const MATCH_RESULT_TEMPLATES: Record<MatchResultTemplateId, { label: string; description: string; active: boolean }> = {
  HERO_SCORE: { label: "Kahraman-Skor", description: "MVP büyük ve net, alt bantta skor şeridi ve golcüler. Beraberlikte iki oyunculu split.", active: true },
  MAGAZINE_COVER: { label: "Dergi Kapağı", description: "Dev \"MAÇ SONUCU\", bulanık sevinç fotoğrafı, çok büyük skor.", active: false },
  FRAME: { label: "Çerçeve", description: "Tam kadraj fotoğraf, turnuva renginde iç çerçeve, ortada \"SONUÇ\" etiketi.", active: false },
};
