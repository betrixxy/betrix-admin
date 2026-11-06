import { pickStar } from "../../src/story/players";
import type { MatchData, PlayerSeason } from "../../src/story/match-data";
import { inSquad } from "../../src/story/squad";
import type { ReelScene } from "../../src/schema";

/**
 * Fotoğraf listesi: video taraf başına tek fotoğraf kullanır (`home-1`, `away-1`). Kişi düello oyuncusudur; düello yoksa
 * güncel kadroda doğrulanan en yüksek gol + asistli oyuncu. Saf; dosya okumaz.
 */

type Side = "home" | "away";

export interface PhotoNeed {
  side: Side;
  slot: string;
  team: string;
  player: PlayerSeason | null;
  reason: string;
  scenes: string[];
  alternates: PlayerSeason[];
}

const contribution = (player: PlayerSeason) => (player.goals ?? 0) + (player.assists ?? 0);
const stat = (player: PlayerSeason) => `${player.goals ?? "?"} gol, ${player.assists ?? "?"} asist, ${player.minutes} dk`;

export function photoPlan(data: MatchData, scenes: readonly ReelScene[], leagueName: string): PhotoNeed[] {
  return (["home", "away"] as const).map((side) => {
    const slot = `${side}-1`;
    const verified = data.players.candidates[side].filter((player) => inSquad(data.players, side, player.id));
    const duel = scenes.find((scene) => scene.type === "P01_DUEL");
    const duelName = duel?.type === "P01_DUEL" ? duel.data[side].name : null;
    const star = verified.find((player) => player.name === duelName) ?? pickStar(verified);
    const using = scenes.filter((scene) => scene.assets.photoIds.includes(slot) || (scene.type === "P01_DUEL" && duelName)).map((scene) => scene.type);
    const reason = star
      ? `${duelName === star.name ? "Düello oyuncusu: " : ""}takımının ${leagueName} bu sezon en yüksek gol + asist katkısı (${stat(star)}); güncel kadroda kimlikle doğrulandı`
      : "Kadroda doğrulanan aday yok: yedek tasarım kullanılır";
    const alternates = verified.filter((player) => player.id !== star?.id).sort((a, b) => contribution(b) - contribution(a)).slice(0, 2);
    return { side, slot, team: data.teams[side].name, player: star, reason, scenes: [...new Set(using)], alternates };
  });
}

export function photoListText(needs: readonly PhotoNeed[]): string {
  const lines = ["FOTOĞRAF LİSTESİ (dosya adı = kişi adı, ör. \"Osimhen.jpg\"; dikey, yüz net, kısa kenar ≥ 1080)", ""];
  for (const need of needs) {
    lines.push(`${need.team} (${need.slot}): ${need.player?.name ?? "—"}`);
    lines.push(`  Neden: ${need.reason}`);
    lines.push(`  Göründüğü sahneler: ${need.scenes.join(", ") || "yok"}`);
    if (need.alternates.length) lines.push(`  Yedek seçenek: ${need.alternates.map((player) => `${player.name} (${stat(player)})`).join("; ")}`);
    lines.push("");
  }
  lines.push("Fotoğrafı olmayan taraf ortak yedek tasarımla çizilir (takım rengi + arma). Yüz iyileştirme yapılmaz.");
  return `${lines.join("\n")}\n`;
}
