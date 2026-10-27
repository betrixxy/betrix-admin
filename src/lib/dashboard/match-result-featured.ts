import { formatNumber } from "@/lib/format/number";
import type { MatchResultFacts, MatchResultTemplateId, MvpCandidate } from "@/types/match-result";

/**
 * Maç Sonucu — maçın oyuncusu ve şablon kataloğu (saf, istemci de kullanır).
 *
 * "MAÇIN OYUNCUSU" satırı tam kadraj fotoğrafla çelişmesin diye YALNIZCA şu durumlarda çizilir:
 * (a) maç fotoğrafının oyuncu etiketi (`MediaAsset.playerId`) seçilen MVP ile aynıysa, ya da
 * (b) admin formda "Fotoğraftaki oyuncu maçın oyuncusu" kutucuğunu işaretlediyse. Aksi halde
 * gizlenir (başlık yuvası sabit kalır, şerit kaymaz). Gönderi metnindeki ⭐ satırı etkilenmez.
 */

export interface MvpLineInput {
  mvp: Pick<MvpCandidate, "playerId" | "name"> | null;
  /** Maç fotoğrafının kütüphane oyuncu etiketi; yoksa null. */
  photoPlayerId: number | null;
  /** Formdaki "Fotoğraftaki oyuncu maçın oyuncusu" kutucuğu. */
  photoIsMvp: boolean;
}

/** Karta yazılacak MVP adı ya da null (satır gizlenir). */
export function mvpLineName({ mvp, photoPlayerId, photoIsMvp }: MvpLineInput): string | null {
  if (!mvp) return null;
  return photoIsMvp || (photoPlayerId !== null && photoPlayerId === mvp.playerId) ? mvp.name : null;
}

/** MVP seçimi: öneri kazanan takımın en yüksek rating'i; liste kazanan takımın oyuncularıyla başlar. */
export function mvpOptions(facts: MatchResultFacts): MvpCandidate[] {
  if (facts.outcome === "DRAW") return facts.players;
  return [...facts.players].sort((a, b) => Number(b.side === facts.outcome) - Number(a.side === facts.outcome));
}

export function playerOptionLabel(player: MvpCandidate, facts: Pick<MatchResultFacts, "home" | "away">): string {
  const team = player.side === "HOME" ? facts.home.name : facts.away.name;
  const parts = [player.name, team];
  if (player.rating !== null) parts.push(formatNumber(player.rating, { decimals: 1 }));
  if (player.goals > 0) parts.push(`${player.goals} gol`);
  return parts.join(" · ");
}

/** Şablon kataloğu — üçü de tam kadraj maç fotoğrafı üstüne çizilir. */
export const MATCH_RESULT_TEMPLATES: Record<MatchResultTemplateId, { label: string; description: string }> = {
  FULL_FRAME: { label: "A · Tam Kadraj", description: "Fotoğraf tüm kart; altta set skor şeridi ve golcüler (02 ile birebir aynı yer)." },
  BIG_SCORE: { label: "B · Dev Skor", description: "Skor ortada dev boyutta, oyuncuların önünde; golcüler skorun altında iki yan listede." },
  HEADLINE: { label: "C · Manşet", description: "Üstte büyük \"MAÇ SONUCU\", fotoğraf ortada, altta minimal skor." },
};
