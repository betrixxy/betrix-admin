import { constants } from "node:fs";
import { copyFile, mkdir, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { CertainMatch, ManualReview } from "@/types/media-server";

/**
 * Hedef klasöre yazma. Kaynak dosyalar yalnızca OKUNUR ve KOPYALANIR — asla taşınmaz/silinmez.
 * `--fresh` yalnızca hedefteki bu scriptin ürettiği alt klasörleri temizler.
 */

export const MANUAL_DIR = "_Manuel_Kontrol";
const MANAGED_ENTRIES = ["teams", "players", MANUAL_DIR, "manifest.json"];

export type PrepareResult = { ok: true } | { ok: false; message: string };

export async function prepareTarget(target: string, fresh: boolean, dryRun: boolean): Promise<PrepareResult> {
  const existing = await readdir(target).catch(() => [] as string[]);
  const managed = existing.filter((entry) => MANAGED_ENTRIES.includes(entry));
  if (managed.length > 0 && !fresh && !dryRun) {
    return {
      ok: false,
      message:
        `Hedef klasör dolu (${managed.join(", ")}). Eski bir çalıştırmanın dosyaları yeni sonuçlarla karışmasın diye ` +
        `durduruldu. Temiz başlamak için --fresh ekleyin (yalnızca bu alt klasörler silinir).`,
    };
  }
  if (dryRun) return { ok: true };
  for (const entry of fresh ? managed : []) await rm(path.join(target, entry), { recursive: true, force: true });
  for (const dir of ["teams", "players", path.join(MANUAL_DIR, "teams"), path.join(MANUAL_DIR, "players")]) {
    await mkdir(path.join(target, dir), { recursive: true });
  }
  return { ok: true };
}

/** Kesin eşleşmeleri `<hedef>/<kind>/<API_ID>.png` olarak kopyalar. */
export async function copyCertain<M extends string>(
  matches: CertainMatch<M>[],
  sourceOf: (fmUid: string) => string | null,
  destDir: string,
  dryRun: boolean,
): Promise<number> {
  let copied = 0;
  for (const match of matches) {
    const source = sourceOf(match.fmUid);
    if (!source) continue;
    // COPYFILE_EXCL: aynı API kimliğine ikinci bir dosya asla yazılmaz (ters tekillik zaten garanti eder).
    if (!dryRun) await copyFile(source, path.join(destDir, `${match.apiId}.png`), constants.COPYFILE_EXCL);
    copied += 1;
  }
  return copied;
}

export async function copyManual(
  reviews: ManualReview[],
  sourceOf: (fmUid: string) => string | null,
  destDir: string,
  dryRun: boolean,
): Promise<number> {
  let copied = 0;
  for (const review of reviews) {
    const source = sourceOf(review.fmUid);
    if (!source) continue;
    if (!dryRun) await copyFile(source, path.join(destDir, path.basename(source)), constants.COPYFILE_EXCL);
    copied += 1;
  }
  return copied;
}

function formatReviews(title: string, reviews: ManualReview[], fileOf: (fmUid: string) => string): string[] {
  const lines = [`==================== ${title} (${reviews.length}) ====================`, ""];
  for (const review of reviews) {
    lines.push(`[${fileOf(review.fmUid)}] ${review.fmLabel}`);
    lines.push(`  Neden: ${review.reason}`);
    if (review.candidates.length === 0) lines.push("  Olası API kaydı: (aday yok)");
    else lines.push("  Olası API kayıtları:");
    for (const c of review.candidates) lines.push(`    - ${c.label} | benzerlik ${(c.similarity * 100).toFixed(0)}%`);
    lines.push("");
  }
  return lines;
}

export async function writeManualLog(
  target: string,
  teamReviews: ManualReview[],
  playerReviews: ManualReview[],
): Promise<void> {
  const header = [
    "CheckMatch Media Server — Manuel Kontrol Listesi",
    `Oluşturulma: ${new Date().toISOString()}`,
    "",
    "Bu klasördeki dosyalar OTOMATİK EŞLEŞTİRİLMEDİ. Her dosya için doğru API kimliğini doğrulayıp",
    "elle teams/<API_TEAM_ID>.png veya players/<API_PLAYER_ID>.png olarak kopyalayın.",
    "",
  ];
  const body = [
    ...formatReviews("TAKIM LOGOLARI → teams/", teamReviews, (uid) => `teams/club_${uid}.png`),
    ...formatReviews("OYUNCU YÜZLERİ → players/", playerReviews, (uid) => `players/face_${uid}.png`),
  ];
  await writeFile(path.join(target, MANUAL_DIR, "log.txt"), [...header, ...body].join("\r\n"), "utf8");
}

export interface Manifest {
  generatedAt: string;
  teams: Record<string, { fmUid: string; fmName: string; apiName: string; method: string }>;
  players: Record<string, { fmUid: string; fmName: string; apiName: string; method: string }>;
}

export function buildManifest<T extends string, P extends string>(
  teams: CertainMatch<T>[],
  players: CertainMatch<P>[],
): Manifest {
  const toRecord = <M extends string>(list: CertainMatch<M>[]) =>
    Object.fromEntries(list.map((m) => [String(m.apiId), { fmUid: m.fmUid, fmName: m.fmName, apiName: m.apiName, method: m.method }]));
  return { generatedAt: new Date().toISOString(), teams: toRecord(teams), players: toRecord(players) };
}
