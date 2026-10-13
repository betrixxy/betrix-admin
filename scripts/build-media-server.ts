/**
 * FM26 logo + facepack → API-Football kimlikli merkezi medya havuzu ("Sıfır Hata").
 *
 *   npx tsx --env-file=.env --env-file=.env.local scripts/build-media-server.ts \
 *     --source <FM grafik klasörü> --target <medya havuzu klasörü> \
 *     --fm-people <fm_oyuncular.html> --fm-clubs <fm_kulupler.html> [--dry-run] [--fresh]
 *
 * FM resim dosyaları isim taşımaz (`face_<FM_UID>.png`, `club_<FM_UID>.png`); isim, doğum tarihi
 * ve kulüp FM26 içinden dışa aktarılan görünümlerden okunur (bkz. lib/media-server/fm-export.ts).
 * Eşleştirme kuralları: lib/media-server/match-teams.ts ve match-players.ts.
 */
import { existsSync } from "node:fs";
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { readFmClubs, readFmPeople } from "@/lib/media-server/fm-export";
import { matchPlayers } from "@/lib/media-server/match-players";
import { buildTeamAliases, matchTeams } from "@/lib/media-server/match-teams";
import type { DateOrder, FmClub, FmPerson, ManualReview } from "@/types/media-server";
import { collectApiPool } from "./media-server/api-pool";
import { buildManifest, copyCertain, copyManual, MANUAL_DIR, prepareTarget, writeManualLog } from "./media-server/output";

const FACES_DIR = path.join("sortitoutsi", "faces");
const LOGOS_DIR = path.join("metallic_logos_2026.01", "sortitoutsi Metallic Logos", "logos", "clubs");
const CACHE_DIR = path.join(process.cwd(), "storage", "media-server-cache");

function fail(message: string): never {
  console.error(`\n✗ ${message}\n`);
  process.exit(1);
}

const { values: args } = parseArgs({
  options: {
    "fm-people": { type: "string" },
    "fm-clubs": { type: "string" },
    /** FM grafik paketlerinin kök klasörü (sortitoutsi faces + metallic logos). */
    source: { type: "string" },
    /** Medya havuzunun yazılacağı klasör. */
    target: { type: "string" },
    "date-format": { type: "string" },
    "dry-run": { type: "boolean", default: false },
    fresh: { type: "boolean", default: false },
    "refresh-api": { type: "boolean", default: false },
  },
});

/** `<dir>` altındaki `<prefix><UID>.png` dosyalarını UID → tam yol olarak indeksler. */
async function indexImages(dirs: string[], prefix: string): Promise<Map<string, string>> {
  const pattern = new RegExp(`^${prefix}(\\d+)\\.png$`, "i");
  const index = new Map<string, string>();
  for (const dir of dirs) {
    for (const file of await readdir(dir).catch(() => [] as string[])) {
      const uid = pattern.exec(file)?.[1];
      if (uid && !index.has(uid)) index.set(uid, path.join(dir, file));
    }
  }
  return index;
}

/** FM dosyasında aynı UID farklı verilerle birden fazla kez geçiyorsa o UID kesinleşemez. */
function dedupe<T extends { uid: string }>(items: T[], describe: (item: T) => string) {
  const byUid = new Map<string, T>();
  const conflicts = new Map<string, T>();
  for (const item of items) {
    const existing = byUid.get(item.uid);
    if (!existing) byUid.set(item.uid, item);
    else if (JSON.stringify(existing) !== JSON.stringify(item)) conflicts.set(item.uid, item);
  }
  for (const uid of conflicts.keys()) byUid.delete(uid);
  const reviews: ManualReview[] = [...conflicts.values()].map((item) => ({
    fmUid: item.uid,
    fmLabel: describe(item),
    reason: "FM dışa aktarımında bu UID farklı verilerle birden fazla kez geçiyor.",
    candidates: [],
  }));
  return { unique: [...byUid.values()], reviews };
}

async function main() {
  const peopleFile = args["fm-people"];
  const clubsFile = args["fm-clubs"];
  if (!peopleFile && !clubsFile) fail("En az biri gerekli: --fm-people <dosya> ve/veya --fm-clubs <dosya>.");
  const dateFormat = args["date-format"]?.toUpperCase();
  if (dateFormat && !["DMY", "MDY", "YMD"].includes(dateFormat)) fail("--date-format yalnızca DMY, MDY veya YMD olabilir.");
  const { source, target } = args;
  if (!source || !target) fail("--source <FM grafik klasörü> ve --target <medya havuzu klasörü> zorunludur.");
  const dryRun = args["dry-run"];
  if (!existsSync(source)) fail(`Kaynak klasör yok: ${source}`);

  console.log("1/5  Kaynak dosyalar indeksleniyor…");
  const faces = await indexImages([path.join(source, FACES_DIR)], "face_");
  const logos = await indexImages([path.join(LOGOS_DIR, "normal"), path.join(LOGOS_DIR, "small")].map((d) => path.join(source, d)), "club_");
  console.log(`     ${faces.size} yüz, ${logos.size} kulüp logosu bulundu.`);

  console.log("2/5  FM dışa aktarımları okunuyor…");
  let people: FmPerson[] = [];
  let clubs: FmClub[] = [];
  if (peopleFile) {
    const parsed = readFmPeople(await readFile(peopleFile, "utf8"), (dateFormat as DateOrder | undefined) ?? null);
    if (!parsed.ok) fail(parsed.error.message);
    people = parsed.data;
  }
  if (clubsFile) {
    const parsed = readFmClubs(await readFile(clubsFile, "utf8"));
    if (!parsed.ok) fail(parsed.error.message);
    clubs = parsed.data;
  }
  const peopleDedup = dedupe(people.filter((p) => faces.has(p.uid)), (p) => `FM: "${p.name}" | DoB ${p.dob ?? "yok"}`);
  const clubsDedup = dedupe(clubs.filter((c) => logos.has(c.uid)), (c) => `FM: "${c.name}" | Ülke: ${c.nation ?? "yok"}`);
  console.log(`     Oyuncu: ${people.length} satır → yüzü olan ${peopleDedup.unique.length}. Kulüp: ${clubs.length} satır → logosu olan ${clubsDedup.unique.length}.`);
  const noDob = peopleDedup.unique.filter((p) => !p.dob).length;
  if (noDob > 0) console.log(`     ⚠ ${noDob} oyuncunun doğum tarihi okunamadı — bunlar asla otomatik eşleşmez.`);

  console.log("3/5  API-Football havuzu toplanıyor (44 lig)…");
  const pool = await collectApiPool(CACHE_DIR, args["refresh-api"], (line) => console.log(line));
  if (pool.failures.length > 0) {
    pool.failures.forEach((f) => console.error(`     ✗ ${f}`));
    fail(`${pool.failures.length} API isteği başarısız — eksik havuzla eşleştirme yapılmaz. Tekrar çalıştırın (başarılı yanıtlar önbellekte).`);
  }
  console.log(`     ${pool.teams.length} takım, ${pool.players.length} oyuncu (${pool.players.filter((p) => p.birthDate).length} tanesi doğum tarihli).`);

  console.log("4/5  Eşleştiriliyor…");
  const teamOutcome = matchTeams(clubsDedup.unique, pool.teams);
  const playerOutcome = matchPlayers(peopleDedup.unique, pool.players, {
    teamNames: new Map(pool.teams.map((t) => [t.id, t.name])),
    teamAliases: buildTeamAliases(pool.teams, teamOutcome.certain, clubsDedup.unique),
  });
  const teamManual = [...teamOutcome.manual, ...clubsDedup.reviews];
  const playerManual = [...playerOutcome.manual, ...peopleDedup.reviews];

  console.log(`5/5  ${dryRun ? "[DRY-RUN — dosya yazılmıyor] " : ""}Kopyalanıyor → ${target}`);
  const prepared = await prepareTarget(target, args.fresh, dryRun);
  if (!prepared.ok) fail(prepared.message);
  const logoOf = (uid: string) => logos.get(uid) ?? null;
  const faceOf = (uid: string) => faces.get(uid) ?? null;
  const teamsCopied = await copyCertain(teamOutcome.certain, logoOf, path.join(target, "teams"), dryRun);
  const playersCopied = await copyCertain(playerOutcome.certain, faceOf, path.join(target, "players"), dryRun);
  const teamsManual = await copyManual(teamManual, logoOf, path.join(target, MANUAL_DIR, "teams"), dryRun);
  const playersManual = await copyManual(playerManual, faceOf, path.join(target, MANUAL_DIR, "players"), dryRun);
  if (!dryRun) {
    await writeManualLog(target, teamManual, playerManual);
    const manifest = buildManifest(teamOutcome.certain, playerOutcome.certain);
    await writeFile(path.join(target, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8");
  }

  const coveredTeams = new Set(teamOutcome.certain.map((m) => m.apiId));
  const coveredPlayers = new Set(playerOutcome.certain.map((m) => m.apiId));
  console.log(`
════════════════════════ RAPOR ${dryRun ? "(DRY-RUN)" : ""} ════════════════════════
 Başarıyla kopyalanan %100 emin olunan dosya sayısı : ${teamsCopied + playersCopied}
     ├─ Takım logosu  (teams/)   : ${teamsCopied}
     └─ Oyuncu yüzü   (players/) : ${playersCopied}
 Manuel kontrole ayrılan şüpheli dosya sayısı      : ${teamsManual + playersManual}
     ├─ Takım logosu              : ${teamsManual}
     └─ Oyuncu yüzü               : ${playersManual}
 Kapsam dışı (API'de benzeri yok, kopyalanmadı)    : ${teamOutcome.outOfScope} logo, ${playerOutcome.outOfScope} yüz
 API kapsamı                                        : ${coveredTeams.size}/${pool.teams.length} takım, ${coveredPlayers.size}/${pool.players.length} oyuncu görselli
═══════════════════════════════════════════════════════════════
${dryRun ? "" : ` Manuel kontrol listesi: ${path.join(target, MANUAL_DIR, "log.txt")}\n`}`);
}

main().catch((error: unknown) => fail(error instanceof Error ? (error.stack ?? error.message) : String(error)));
