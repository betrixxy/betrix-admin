import "./reel/setup-env";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { checkAssets } from "./tactical/assets";
import { planSource, tacticalPlan } from "./tactical/plan";
import { scenarioTacticalText } from "./tactical/scenario";
import { creditPlan } from "./tactical/voicing";
import { freezeMatch, REAL_ROOT, type Frozen } from "./reel/freeze";
import { buildReel, captionFiles, scenarioText, slugOf, type BuiltReel } from "./reel/build";
import { hasKey } from "./reel/setup-env";
import { withReelsTunnel } from "./reel/tunnel";
import { photoListText, photoPlan } from "./reel/photos";
import { bigMatchReason, defaultProfile, VOICE_PROFILES, type VoiceProfile, type VoiceProfileId } from "./reel/voice";
import { ARCHIVE_TEAM_NAMES } from "@/lib/archive/names";
import { addDays, istanbulDay } from "@/lib/metrics/istanbul-time";
import { publishWindow } from "@/lib/reels/publish-window";
import { REELS_DEFAULT_LEAGUE_IDS } from "@/lib/reels/selection";
import { getReelsMatches } from "@/lib/services/reels-client";

/**
 * Gerçek veriyle video hattı. Uygulamaya bağlı değil, veritabanına yazmaz. Çıktı `test-photos/reels-real/<maç>/`.
 * Varsayılan format "Canlı taktik tahtası" (kullanıcı 2026-11-07):
 *   npm run reel -- --match <id> [--profile buyuk-mac|standart|alternatif] [--dondur]
 *       1. snapshot dondur (klasörde varsa onu kullanır; --dondur yeniden dondurur)
 *       2. varlık kontrolü (stadyum, logolar, düello fotoğrafı: forma takımı + sezon); eksik varsa eksik-varliklar.txt, DUR
 *       3. senaryo-tactical.txt yaz, DUR (onay beklenir)
 *   npm run reel -- --match <id> --onay [--profile …] [--kredi-siniri 700]
 *       ses (yalnız önbellekte olmayan beat'ler) + render + kapak + aciklama.txt + Telegram önizlemesi + rapor → <maç>/taktik/
 * Eski sahne havuzu (`--format legacy`):
 *   npm run reel -- --match <id> --format legacy [--photos <klasör>]   dondur; senaryo.txt, fotograf-listesi.txt, aciklama.txt yaz, DUR
 *     [--profile buyuk-mac|standart|alternatif] [--big-match | --no-big-match]   ses profili; varsayılan büyük maç önerisinden
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
    `ses kartı aşabilir: ${reel.longVoice.length ? reel.longVoice.join(" | ") : "yok"}`,
  ].join("\n");
}

const isTurkish = (teamId: number) => teamId in ARCHIVE_TEAM_NAMES;

function chooseProfile(frozen: Frozen): { profile: VoiceProfile; header: string } {
  const reason = bigMatchReason({ leagueId: frozen.detail.match.league.id, homeId: frozen.detail.teams.home.id, awayId: frozen.detail.teams.away.id, isTurkish });
  const flag = has("--big-match") ? true : has("--no-big-match") ? false : reason !== null;
  const asked = argument("--profile");
  if (asked && !(asked in VOICE_PROFILES)) throw new Error(`Bilinmeyen ses profili: ${asked} (${Object.keys(VOICE_PROFILES).join(", ")})`);
  const id = (asked as VoiceProfileId | null) ?? defaultProfile(flag);
  const source = asked ? "elle seçildi" : has("--big-match") || has("--no-big-match") ? "büyük maç işareti elle" : reason ? `öneri: ${reason}` : "öneri yok (derbi / ŞL / Türk takımının Avrupa maçı değil)";
  return { profile: VOICE_PROFILES[id], header: `Büyük maç: ${flag ? "işaretli" : "işaretsiz"} (${source}) → profil "${VOICE_PROFILES[id].label}"` };
}

async function produce(matchId: number): Promise<void> {
  const frozen = await withReelsTunnel(() => freezeMatch(matchId));
  const { profile, header } = chooseProfile(frozen);
  const reel = buildReel(frozen, profile);
  const folder = path.join(REAL_ROOT, slugOf(frozen, matchId));
  mkdirSync(folder, { recursive: true });
  writeFileSync(path.join(folder, "snapshot.json"), JSON.stringify(frozen, null, 1));
  writeFileSync(path.join(folder, "script.json"), JSON.stringify(reel.script, null, 1));
  writeFileSync(path.join(folder, "seslendirme.json"), JSON.stringify({ profile: reel.profile, scenes: reel.script.scenes.map((scene, index) => ({ type: scene.type, text: reel.spoken[index] })) }, null, 1));
  writeFileSync(path.join(folder, "senaryo.txt"), scenarioText(reel, frozen, [header]));
  if (profile.id !== "buyuk-mac") {
    const big = buildReel(frozen, VOICE_PROFILES["buyuk-mac"]);
    writeFileSync(path.join(folder, "senaryo-buyuk-mac.txt"), scenarioText(big, frozen, ["Karşılaştırma: \"büyük maç\" işaretlenirse bu metin okunur."]));
  }
  writeFileSync(path.join(folder, "fotograf-listesi.txt"), photoListText(photoPlan(reel.data, reel.script.scenes, frozen.extras.league_name)));
  writeFileSync(path.join(folder, "aciklama.txt"), captionFiles(reel, frozen));
  console.log(header);
  console.log(summary(reel, frozen));
  console.log(`ses: ${hasKey("ELEVENLABS_API_KEY") ? "anahtar var" : "anahtar yok, sessiz"}`);
  console.log(`çıktı: ${folder}`);
  process.exitCode = reel.problems.length || !frozen.quality_ok ? 1 : 0;
}

const PKG = path.resolve(import.meta.dirname, "..");
const STUDIO = path.resolve(PKG, "..");
const PUBLIC = path.join(PKG, "public");
const VOICE_CACHE = path.resolve(STUDIO, "../test-photos/reels-voice/_onbellek");

/** Taktik tahtası: dondur → varlık kontrolü → senaryo (DUR) | --onay ile tam üretim. */
async function produceTactical(matchId: number): Promise<void> {
  const existing = existsSync(REAL_ROOT) ? readdirSync(REAL_ROOT).find((name) => name.endsWith(`-${matchId}`) && existsSync(path.join(REAL_ROOT, name, "snapshot.json"))) : undefined;
  let folder: string;
  let frozen: Frozen;
  if (existing && !has("--dondur")) {
    folder = path.join(REAL_ROOT, existing);
    frozen = JSON.parse(readFileSync(path.join(folder, "snapshot.json"), "utf8")) as Frozen;
    console.log(`snapshot: mevcut (${frozen.fetched_at}); yeniden dondurmak için --dondur`);
  } else {
    frozen = await withReelsTunnel(() => freezeMatch(matchId));
    folder = path.join(REAL_ROOT, slugOf(frozen, matchId));
    mkdirSync(folder, { recursive: true });
    writeFileSync(path.join(folder, "snapshot.json"), JSON.stringify(frozen, null, 1));
    console.log(`snapshot: donduruldu (${frozen.fetched_at})`);
  }
  if (!frozen.quality_ok) throw new Error("kalite denetimi geçmedi (snapshot quality_ok = false)");
  const { profile, header } = chooseProfile(frozen);
  const source = planSource(frozen);
  const { items, problems } = tacticalPlan(source);
  if (problems.length) throw new Error(`senaryo engeli: ${problems.join(" | ")}`);
  const assets = checkAssets(folder, frozen, source, PUBLIC, STUDIO);
  if (assets.missing.length) {
    const list = `EKSİK VARLIKLAR (${frozen.extras.teams.home.name} – ${frozen.extras.teams.away.name})\n${assets.missing.map((item) => `- ${item}`).join("\n")}\n`;
    writeFileSync(path.join(folder, "eksik-varliklar.txt"), list);
    console.error(list);
    console.error(`çıktı: ${folder}`);
    process.exitCode = 1;
    return;
  }
  const scenario = path.join(folder, "senaryo-tactical.txt");
  if (!has("--onay")) {
    const credit = creditPlan(items, VOICE_CACHE, profile);
    writeFileSync(scenario, scenarioTacticalText({ frozen, source, items, profile, assets, fresh: credit.fresh, estimatedCredits: credit.estimatedCredits }));
    console.log(header);
    console.log(`senaryo: ${scenario}`);
    console.log(`onay bekleniyor → npm run reel -- --match ${matchId} --onay   (profil: ${profile.id}, senaryodan okunur)`);
    return;
  }
  if (!existsSync(scenario)) throw new Error("önce senaryo üret (--onay olmadan) ve oku");
  // Onaylanan metni seslendirecek profil senaryodan okunur (maça göre yeniden seçilmez); --profile ile çelişirse durulur.
  const approvedProfile = /^Profil: (\S+)$/mu.exec(readFileSync(scenario, "utf8"))?.[1];
  if (!approvedProfile) throw new Error("senaryoda profil satırı yok: senaryoyu yeniden üret");
  const asked = argument("--profile");
  if (asked && asked !== approvedProfile) throw new Error(`--profile ${asked} onaylı senaryonun profiliyle (${approvedProfile}) çelişiyor`);
  const run = spawnSync(process.platform === "win32" ? "npx.cmd" : "npx", ["tsx", "--tsconfig", "tsconfig.json", "reels-video/scripts/reel-render.ts", folder, "--full", "--kredi-siniri", argument("--kredi-siniri") ?? "700", "--profile", approvedProfile], { cwd: STUDIO, stdio: "inherit", shell: process.platform === "win32" });
  process.exitCode = run.status ?? 1;
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
    if (!Number.isInteger(id) || id <= 0) throw new Error("Kullanım: npm run reel -- --match <id> [--profile …] [--onay] | --format legacy | --candidates [--ids a,b,c]");
    if (argument("--format") === "legacy") await produce(id);
    else await produceTactical(id);
  }
} catch (cause) {
  // Hata metnine yalnız mesaj yazılır: anahtar taşıyan istek ayrıntısı dökülmez.
  console.error(cause instanceof Error ? cause.message : "Bilinmeyen hata");
  process.exitCode = 1;
}
process.exit(process.exitCode ?? 0);
