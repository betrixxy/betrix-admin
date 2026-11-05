import "./reel/setup-env";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { freezeMatch, REAL_ROOT, type Frozen } from "./reel/freeze";
import { buildReel, captionFiles, scenarioText, slugOf, type BuiltReel } from "./reel/build";
import { hasKey } from "./reel/setup-env";
import { withReelsTunnel } from "./reel/tunnel";
import { addDays, istanbulDay } from "@/lib/metrics/istanbul-time";
import { publishWindow } from "@/lib/reels/publish-window";
import { REELS_DEFAULT_LEAGUE_IDS } from "@/lib/reels/selection";
import { getReelsMatches } from "@/lib/services/reels-client";

/**
 * Gerçek veriyle video hattı. Uygulamaya bağlı değil, veritabanına yazmaz. Çıktı `test-photos/reels-real/<maç>/`.
 *   npm run reel -- --match <id> [--photos <klasör>]   dondur, senaryo.txt ve aciklama.txt yaz, DUR
 *   npm run reel -- --candidates                       yayın penceresi açık maçların listesi ve kalite özeti
 */

const argument = (name: string): string | null => {
  const at = process.argv.indexOf(name);
  return at >= 0 ? process.argv[at + 1] ?? null : null;
};
const has = (name: string) => process.argv.includes(name);

function summary(reel: BuiltReel, frozen: Frozen): string {
  return [
    `kalite: ${frozen.quality_ok ? "tamam" : "GEÇMEDİ"} | kadro: ${frozen.squad_checked_at ?? "doğrulanamadı"}`,
    `sahne ${reel.script.scenes.length}, ${reel.seconds.toFixed(1)} sn: ${reel.script.scenes.map((scene) => scene.type).join(" ")}`,
    `engel: ${reel.problems.length ? reel.problems.join(" | ") : "yok"}`,
    `uyarı: ${frozen.warnings.length ? frozen.warnings.join(" | ") : "yok"}`,
  ].join("\n");
}

async function produce(matchId: number): Promise<void> {
  const frozen = await withReelsTunnel(() => freezeMatch(matchId));
  const reel = buildReel(frozen);
  const folder = path.join(REAL_ROOT, slugOf(frozen, matchId));
  mkdirSync(folder, { recursive: true });
  writeFileSync(path.join(folder, "snapshot.json"), JSON.stringify(frozen, null, 1));
  writeFileSync(path.join(folder, "script.json"), JSON.stringify(reel.script, null, 1));
  writeFileSync(path.join(folder, "senaryo.txt"), scenarioText(reel, frozen));
  writeFileSync(path.join(folder, "aciklama.txt"), captionFiles(reel, frozen));
  console.log(summary(reel, frozen));
  console.log(`ses: ${hasKey("ELEVENLABS_API_KEY") ? "anahtar var" : "anahtar yok, sessiz"}`);
  console.log(`çıktı: ${folder}`);
  process.exitCode = reel.problems.length || !frozen.quality_ok ? 1 : 0;
}

async function candidates(): Promise<void> {
  const now = new Date();
  const today = istanbulDay(now);
  const endOfTomorrow = new Date(`${addDays(today, 2)}T00:00:00+03:00`);
  await withReelsTunnel(async () => {
    const list = await getReelsMatches({ from: today, to: addDays(today, 2), leagues: REELS_DEFAULT_LEAGUE_IDS });
    if (!list.ok) throw new Error(list.error.message);
    const open = list.data.matches.filter((match) => {
      const window = publishWindow(new Date(match.kickoff_utc));
      return match.analysis.available && window.publishFrom < endOfTomorrow && window.publishTo > now;
    });
    console.log(`liste ${list.data.matches.length}, pencereye uyan ${open.length}`);
    const only = argument("--ids")?.split(",").map(Number) ?? null;
    if (!only) {
      for (const match of open) console.log(`${match.match_id} | ${match.kickoff_utc} | ${match.league.name} (${match.league.id}) | ${match.home.name} - ${match.away.name}`);
      return;
    }
    for (const id of only) {
      const frozen = await freezeMatch(id, now);
      const reel = buildReel(frozen);
      console.log(`\n=== ${id} ${frozen.extras.teams.home.name} - ${frozen.extras.teams.away.name} | ${frozen.detail.match.kickoff_utc}`);
      console.log(summary(reel, frozen));
      console.log(`kapalı: ${reel.script.disabled.filter((item) => ["C01_STORY", "M02_MONTE_CARLO", "C02_FORM", "C03_ABSENCES", "C04_TEAM_HOME", "C05_TEAM_AWAY", "C06_MINUTES", "Q04_GOALS", "Q05_BOTH_SCORE", "Q12_FIRST_GOAL", "C07_KEY", "C08_UPSET", "C09_SCENARIO", "P01_DUEL", "P02_VS_OPPONENT"].includes(item.type)).map((item) => `${item.type}: ${item.reason}`).join(" | ") || "yok"}`);
      console.log(`sonuç: ev %${Math.round(frozen.detail.outcome.home_win * 100)} ber %${Math.round(frozen.detail.outcome.draw * 100)} dep %${Math.round(frozen.detail.outcome.away_win * 100)} | puan: ${frozen.extras.context?.standings.home?.rank ?? "?"}. - ${frozen.extras.context?.standings.away?.rank ?? "?"}.`);
      console.log(`fotoğraf: ${reel.photoNeeds.join(", ") || "yok"}`);
      console.log(`kontrol: ${frozen.detail.quality.checks.filter((check) => !check.ok).map((check) => check.name).join(", ") || "hepsi geçti"} | stale ${frozen.detail.quality.stale} | hesap ${frozen.detail.model.computed_at}`);
      console.log(`istek: ${Object.values(frozen.requests).reduce((sum, value) => sum + value, 0)}`);
    }
  });
}

try {
  if (has("--candidates")) await candidates();
  else {
    const id = Number(argument("--match"));
    if (!Number.isInteger(id) || id <= 0) throw new Error("Kullanım: npm run reel -- --match <id> [--photos <klasör>] | --candidates [--ids a,b,c]");
    await produce(id);
  }
} catch (cause) {
  // Hata metnine yalnız mesaj yazılır: anahtar taşıyan istek ayrıntısı dökülmez.
  console.error(cause instanceof Error ? cause.message : "Bilinmeyen hata");
  process.exitCode = 1;
}
process.exit(process.exitCode ?? 0);
