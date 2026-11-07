import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import type { Frozen } from "../reel/freeze";
import type { PlanSource } from "./plan";

/**
 * Taktik tahtası için varlık kontrolü (üretimin ilk adımı; eksik varsa liste yazılır ve DURULUR):
 *   - stadyum fotoğrafı: `fotograflar/<stadyum>/` (takım klasörü olmayan klasör), puanlamada VENUE
 *   - takım logoları: `public/<extras.teams.*.logo>`
 *   - düello oyuncularının fotoğrafı (kalıcı arşiv kuralı): `fotograflar/<Takım>/<Kişi>/`; forma takımı = oyuncunun takımı
 *     (forma renk eşleşmesi ≥ %40), sezon güncel ya da tarihsiz (önceki sezon yalnız açık onayla), yüz bulunmuş.
 * Puanlama yerel `photo-score.ts` (yüz, netlik, forma rengi, sezon; Fal'a gitmez); sonuç eskiyse yeniden koşulur. Seçim
 * `fotograflar/onayli.json` ({ "home": "<sha12>", "away": "<sha12>" }) varsa oradan, yoksa en yüksek puanlı uygun fotoğraf.
 */

export const CURRENT_SEASON = "2026-27";
export const MIN_KIT_MATCH = 0.4;

interface Scored {
  file: string; group: string; kind: "PORTRAIT" | "TEAM" | "VENUE"; team: { id: number; name: string } | null; person: string | null;
  sha256: string; score: number; kitMatch: number | null; season: string | null; faces: number; warnings: string[];
}

export interface PhotoChoice { file: string; sha: string; person: string; score: number; source: "onaylı" | "en yüksek puan" }
export interface AssetCheck { missing: string[]; venue: string | null; duel: { home: PhotoChoice | null; away: PhotoChoice | null }; notes: string[] }

const fold = (text: string) => text.toLocaleLowerCase("tr-TR").normalize("NFD").replace(/[̀-ͯ]/gu, "").replace(/[^a-z0-9]/gu, "");
function distance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i += 1) {
    let previous = row[0] ?? 0;
    row[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const current = row[j] ?? 0;
      row[j] = Math.min((row[j] ?? 0) + 1, (row[j - 1] ?? 0) + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1));
      previous = current;
    }
  }
  return row[b.length] ?? 0;
}
/** Klasör adı oyuncu adıyla eşleşir mi ("Oshimen" ↔ "Osimhen"): katlanmış adda en çok 2 harf farkı. */
export const samePerson = (folder: string, name: string) => distance(fold(folder), fold(name)) <= 2;

const IMAGE = /\.(jpe?g|png|webp)$/iu;
function newestImage(dir: string): number {
  if (!existsSync(dir)) return 0;
  let newest = 0;
  for (const name of readdirSync(dir)) {
    if (name.startsWith("_")) continue;
    const full = path.join(dir, name);
    const stat = statSync(full);
    newest = Math.max(newest, stat.isDirectory() ? newestImage(full) : IMAGE.test(name) ? stat.mtimeMs : 0);
  }
  return newest;
}

/** Puanlama sonucu (gerekirse yeniden koşar). Kökten çalışır: model ve önbellek yolları kökten. */
function scores(folder: string, studioRoot: string): Scored[] {
  const photos = path.join(folder, "fotograflar");
  const file = path.join(photos, "_secim", "puanlar.json");
  if (!existsSync(photos)) return [];
  if (!existsSync(file) || statSync(file).mtimeMs < newestImage(photos)) {
    execFileSync(process.platform === "win32" ? "npx.cmd" : "npx", ["tsx", "--tsconfig", "tsconfig.json", "reels-video/scripts/reel/photo-score.ts", folder], { cwd: studioRoot, stdio: "inherit", shell: process.platform === "win32" });
  }
  return existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as Scored[]) : [];
}

/** Puanlama dosya yolu göreli yazılmış olabilir (çalışma dizinine göre): "fotograflar/..." kısmı maç klasörüne bağlanır. */
export function resolvePhoto(folder: string, file: string): string {
  if (path.isAbsolute(file) && existsSync(file)) return file;
  const at = file.replace(/\\/gu, "/").lastIndexOf("fotograflar/");
  return at >= 0 ? path.join(folder, file.replace(/\\/gu, "/").slice(at)) : path.resolve(folder, file);
}

export const eligible = (item: Scored) => item.kind === "PORTRAIT" && (item.kitMatch ?? 0) >= MIN_KIT_MATCH && (item.season === null || item.season === CURRENT_SEASON) && item.faces > 0;

export function checkAssets(folder: string, frozen: Frozen, source: PlanSource, publicDir: string, studioRoot: string): AssetCheck {
  const missing: string[] = [];
  const notes: string[] = [];
  const extras = frozen.extras as unknown as { venue: string | null; teams: Record<"home" | "away", { id: number; name: string; logo: string }> };
  for (const side of ["home", "away"] as const) {
    const logo = extras.teams[side].logo;
    if (!logo || !existsSync(path.join(publicDir, logo))) missing.push(`${extras.teams[side].name} logosu yok: public/${logo || `_local/logos/${extras.teams[side].id}.png`}`);
  }
  const scored = scores(folder, studioRoot);
  const approvedFile = path.join(folder, "fotograflar", "onayli.json");
  const approved = existsSync(approvedFile) ? (JSON.parse(readFileSync(approvedFile, "utf8")) as Partial<Record<"home" | "away" | "venue", string>>) : {};
  // Stadyum: onaylı dosya (ad ya da sha öneki) varsa o, yoksa en yüksek puanlı VENUE.
  const venues = scored.filter((item) => item.kind === "VENUE").sort((a, b) => b.score - a.score);
  const pinnedVenue = approved.venue ? venues.find((item) => path.basename(item.file) === approved.venue || item.sha256.startsWith(approved.venue ?? "")) : undefined;
  const venuePick = pinnedVenue ?? venues[0];
  const venue = venuePick ? resolvePhoto(folder, venuePick.file) : null;
  if (!venue) missing.push(`stadyum fotoğrafı yok (${extras.venue ?? "stadyum bilinmiyor"}): fotograflar/${extras.venue ?? "<Stadyum>"}/ klasörüne koy`);
  const choose = (side: "home" | "away"): PhotoChoice | null => {
    const player = source[side].duel;
    const team = extras.teams[side];
    if (!player) { missing.push(`${team.name}: düello oyuncusu yok (snapshot adayı boş)`); return null; }
    const own = scored.filter((item) => item.kind === "PORTRAIT" && item.team?.id === team.id && item.person && samePerson(item.person, player.name));
    const fit = own.filter(eligible).sort((a, b) => b.score - a.score);
    const pinned = approved[side] ? fit.find((item) => item.sha256.startsWith(approved[side] ?? "")) : undefined;
    if (approved[side] && !pinned) notes.push(`${player.name}: onayli.json'daki fotoğraf (${approved[side]}) uygun değil ya da yok; en yüksek puanlı uygun fotoğraf seçildi`);
    const pick = pinned ?? fit[0];
    if (!pick) {
      const why = own.length ? own.map((item) => `${path.basename(item.file)}: ${[(item.kitMatch ?? 0) < MIN_KIT_MATCH ? "forma takımı tutmuyor" : "", item.season && item.season !== CURRENT_SEASON ? `sezon ${item.season}` : "", item.faces ? "" : "yüz yok"].filter(Boolean).join(", ")}`).join("; ") : "klasör/fotoğraf yok";
      missing.push(`${player.name} (${team.name}) için uygun fotoğraf yok (${why}): fotograflar/<${team.name}>/${player.name}/ klasörüne güncel formalı, bu sezon ya da tarihsiz fotoğraf koy`);
      return null;
    }
    return { file: resolvePhoto(folder, pick.file), sha: pick.sha256.slice(0, 12), person: player.name, score: pick.score, source: pinned ? "onaylı" : "en yüksek puan" };
  };
  return { missing, venue, duel: { home: choose("home"), away: choose("away") }, notes };
}
