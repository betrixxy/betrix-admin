import "./setup-env";
import { readdirSync, readFileSync, mkdirSync, writeFileSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import sharp from "sharp";
import { planCrop, prominentFaces, saliencyPoint, type CropBox } from "@/lib/dashboard/match-photo/crop";
import { detectFaces, type FaceBox } from "@/lib/dashboard/match-photo/faces";
import { measureSharpness } from "@/lib/dashboard/match-photo/quality";

/**
 * Bir maç klasöründeki aday fotoğrafları puanlar ve kontak sayfası yazar. Yalnız yerel iş (yüz tespiti YuNet, netlik, renk);
 * Fal'a gitmez, veritabanına yazmaz. Kök dizinden çalışır (model ve önbellek yolları kökten):
 *   npx tsx --tsconfig tsconfig.json reels-video/scripts/reel/photo-score.ts <maç klasörü>
 * Klasör yapısı: <Takım>/<Kişi>/*.jpg portre, <Takım>/*.jpg takım fotoğrafı, <Stadyum>/*.jpg (takım klasörü değilse) stadyum.
 * Çıktı `<maç klasörü>/fotograflar/_secim/`: önizlemeler, puanlar.json, kontak.html.
 */

type Kind = "PORTRAIT" | "TEAM" | "VENUE";
interface Team { id: number; name: string; primary: string; secondary: string }
interface Scored {
  takenAt: string | null; season: string | null; dateSource: string | null;
  file: string; group: string; kind: Kind; team: Team | null; person: string | null; sha256: string;
  width: number; height: number; sharpness: number; faces: number; prominent: number; faceSize: number; faceSharpness: number | null;
  kitMatch: number | null; score: number; parts: Record<string, number>; warnings: string[]; previews: Record<string, string>;
}

const root = process.argv[2];
if (!root) throw new Error("Kullanım: photo-score.ts <maç klasörü>");
const photosDir = path.join(root, "fotograflar");
const out = path.join(photosDir, "_secim");
mkdirSync(out, { recursive: true });

const snapshot = JSON.parse(readFileSync(path.join(root, "snapshot.json"), "utf8")) as {
  detail: { teams: { home: { id: number; name: string }; away: { id: number; name: string } } };
  extras: { teams: { home: { colors?: { primary: string; secondary: string } }; away: { colors?: { primary: string; secondary: string } } } };
};
const teamOf = (side: "home" | "away"): Team => ({
  id: snapshot.detail.teams[side].id, name: snapshot.detail.teams[side].name,
  primary: snapshot.extras.teams[side].colors?.primary ?? "#888888", secondary: snapshot.extras.teams[side].colors?.secondary ?? "#cccccc",
});
const teams = [teamOf("home"), teamOf("away")];
const fold = (text: string) => text.toLocaleLowerCase("tr-TR").normalize("NFD").replace(/[̀-ͯ]/gu, "").replace(/[^a-z0-9]/gu, "");
/** Klasör adı takım adıyla eşleşir mi ("Amedspor" ↔ "Amed SFK"): ilk 4 harf. */
const folderTeam = (name: string) => teams.find((team) => fold(team.name).slice(0, 4) === fold(name).slice(0, 4)) ?? null;

const IMAGE = /\.(jpe?g|png|webp)$/iu;
const list = (dir: string) => readdirSync(dir).filter((name) => !name.startsWith("_"));

function entries(): { file: string; group: string; kind: Kind; team: Team | null; person: string | null }[] {
  const found: { file: string; group: string; kind: Kind; team: Team | null; person: string | null }[] = [];
  for (const top of list(photosDir)) {
    const topPath = path.join(photosDir, top);
    if (!statSync(topPath).isDirectory()) continue;
    const team = folderTeam(top);
    for (const name of list(topPath)) {
      const full = path.join(topPath, name);
      if (statSync(full).isDirectory()) {
        for (const file of list(full).filter((item) => IMAGE.test(item))) found.push({ file: path.join(full, file), group: `${top}/${name}`, kind: "PORTRAIT", team, person: name });
      } else if (IMAGE.test(name)) found.push({ file: full, group: top, kind: team ? "TEAM" : "VENUE", team, person: null });
    }
  }
  return found;
}

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const rgbOf = (hex: string) => [1, 3, 5].map((at) => Number.parseInt(hex.slice(at, at + 2), 16)) as [number, number, number];
function hsl(r: number, g: number, b: number): [number, number, number] {
  const [rn, gn, bn] = [r / 255, g / 255, b / 255];
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn), l = (max + min) / 2, d = max - min;
  if (d === 0) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = max === rn ? ((gn - bn) / d) % 6 : max === gn ? (bn - rn) / d + 2 : (rn - gn) / d + 4;
  return [(h * 60 + 360) % 360, s, l];
}
const hueGap = (a: number, b: number) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b));

/** Forma bölgesinde (yüzün altı, yoksa bütün kare) doygun piksellerin takım renklerine düşen payı. Beyaz/siyah sayılmaz. */
async function kitMatch(bytes: Buffer, width: number, height: number, team: Team, face: FaceBox | null): Promise<number | null> {
  const region = face
    ? { left: Math.max(0, Math.round(face.x - face.width)), top: Math.min(height - 1, Math.round(face.y + face.height * 1.3)), width: 0, height: 0 }
    : { left: 0, top: 0, width, height };
  if (face) {
    region.width = Math.max(1, Math.min(width - region.left, Math.round(face.width * 3)));
    region.height = Math.max(1, Math.min(height - region.top, Math.round(face.height * 2.5)));
    if (region.height < 8) return null;
  }
  const { data, info } = await sharp(bytes).extract(region).resize(64, 64, { fit: "fill" }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const targets = [team.primary, team.secondary].map((hex) => hsl(...rgbOf(hex)));
  let match = 0, other = 0;
  for (let index = 0; index < data.length; index += info.channels) {
    const [h, s, l] = hsl(data[index] ?? 0, data[index + 1] ?? 0, data[index + 2] ?? 0);
    if (s < 0.3 || l < 0.12 || l > 0.9) continue;
    // Ten rengi (turuncu-kahve, orta doygunluk) forma sayılmaz.
    if (h >= 10 && h <= 40 && s < 0.6 && l > 0.25 && l < 0.75) continue;
    if (targets.some(([th]) => hueGap(h, th) <= 22)) match += 1; else other += 1;
  }
  return match + other < 40 ? null : match / (match + other);
}

const CURRENT_SEASON = "2026-27";
const FRAME = { width: 1080, height: 1920 };
const SAFE = { left: 90, right: FRAME.width - 200, top: 252, bottom: FRAME.height - 420 };

async function duotone(bytes: Buffer, team: Team): Promise<Buffer> {
  const { data, info } = await sharp(bytes).greyscale().raw().toBuffer({ resolveWithObject: true });
  const dark = rgbOf(team.primary).map((value) => value * 0.35);
  const light = rgbOf(team.secondary);
  const rgb = Buffer.alloc(info.width * info.height * 3);
  for (let index = 0; index < info.width * info.height; index += 1) {
    const t = (data[index] ?? 0) / 255;
    for (let c = 0; c < 3; c += 1) rgb[index * 3 + c] = Math.round((dark[c] ?? 0) * (1 - t) + (light[c] ?? 0) * t);
  }
  return sharp(rgb, { raw: { width: info.width, height: info.height, channels: 3 } }).jpeg({ quality: 82 }).toBuffer();
}

async function cropTo(bytes: Buffer, box: CropBox, width: number, height: number): Promise<Buffer> {
  const left = Math.max(0, box.left), top = Math.max(0, box.top);
  const region = { left, top, width: Math.min(width - left, box.width), height: Math.min(height - top, box.height) };
  return sharp(bytes).extract(region).resize(540, 960, { fit: "cover" }).jpeg({ quality: 82 }).toBuffer();
}

async function score(item: ReturnType<typeof entries>[number]): Promise<Scored> {
  const raw = readFileSync(item.file);
  const bytes = await sharp(raw).rotate().jpeg({ quality: 95 }).toBuffer();
  const { width = 0, height = 0 } = await sharp(bytes).metadata();
  // Tarih: EXIF DateTimeOriginal, yoksa dosya adındaki YYYY-MM-DD. Sezon Temmuz–Haziran.
  const exif = (await sharp(raw).metadata()).exif?.toString("latin1") ?? "";
  const stamp = /(20\d{2}):(\d{2}):(\d{2}) \d{2}:\d{2}:\d{2}/u.exec(exif) ?? /(20\d{2})-(\d{2})-(\d{2})/u.exec(path.basename(item.file));
  const takenAt = stamp ? `${stamp[1]}-${stamp[2]}-${stamp[3]}` : null;
  const startYear = stamp ? Number(stamp[1]) - (Number(stamp[2]) < 7 ? 1 : 0) : null;
  const season = startYear ? `${startYear}-${String((startYear + 1) % 100).padStart(2, "0")}` : null;
  const dateSource = stamp ? (exif && /(20\d{2}):(\d{2}):(\d{2}) /u.test(exif) ? "EXIF" : "dosya adı") : null;
  const sha256 = createHash("sha256").update(raw).digest("hex");
  const sharpness = await measureSharpness(bytes);
  const faces = item.kind === "VENUE" ? [] : await detectFaces(bytes, `score-${sha256}`);
  const prominent = prominentFaces(faces);
  const main = [...prominent].sort((a, b) => b.width * b.height - a.width * a.height)[0] ?? null;
  let faceSharpness: number | null = null;
  if (main) {
    const left = Math.max(0, Math.round(main.x)), top = Math.max(0, Math.round(main.y));
    const crop = await sharp(bytes).extract({ left, top, width: Math.max(1, Math.min(width - left, Math.round(main.width))), height: Math.max(1, Math.min(height - top, Math.round(main.height))) }).jpeg().toBuffer();
    faceSharpness = await measureSharpness(crop);
  }
  const faceSize = main ? Math.round(Math.min(main.width, main.height)) : 0;
  const kit = item.team && item.kind !== "VENUE" ? await kitMatch(bytes, width, height, item.team, item.kind === "PORTRAIT" ? main : null) : null;
  const short = Math.min(width, height);
  const parts: Record<string, number> = { cozunurluk: clamp01((short - 400) / (1080 - 400)), netlik: clamp01(sharpness / 150) };
  const warnings: string[] = [];
  if (short < 1080) warnings.push(`kısa kenar ${short} px (< 1080; büyütme gerekir)`);
  if (sharpness < 45) warnings.push(`netlik ${sharpness.toFixed(0)} (< 45)`);
  if (item.kind === "PORTRAIT") {
    parts.yuz = main ? clamp01(faceSize / 200) * 0.6 + clamp01((faceSharpness ?? 0) / 150) * 0.4 : 0;
    parts.tek_kisi = prominent.length === 1 ? 1 : prominent.length === 0 ? 0 : 0.3;
    parts.forma = kit ?? 0.5;
    if (!main) warnings.push("yüz bulunamadı");
    if (prominent.length > 1) warnings.push(`karede ${prominent.length} belirgin yüz`);
    if (main && faceSize < 120) warnings.push(`yüz küçük (${faceSize} px)`);
  } else if (item.kind === "TEAM") parts.forma = kit ?? 0.5;
  if (kit !== null && kit < 0.4) warnings.push(`forma renkleri takım renkleriyle uyuşmuyor (%${Math.round(kit * 100)}): eski forma olabilir`);
  if (kit === null && item.kind !== "VENUE") warnings.push("forma rengi ölçülemedi");
  if (season && season !== CURRENT_SEASON) warnings.push(`tarih ${takenAt} (${dateSource}) → sezon ${season}: önceki sezon, yalnız onayla`);
  const weights: Record<Kind, Record<string, number>> = {
    PORTRAIT: { cozunurluk: 0.25, netlik: 0.15, yuz: 0.25, tek_kisi: 0.15, forma: 0.2 },
    TEAM: { cozunurluk: 0.35, netlik: 0.3, forma: 0.35 },
    VENUE: { cozunurluk: 0.5, netlik: 0.5 },
  };
  const total = Object.entries(weights[item.kind]).reduce((sum, [key, weight]) => sum + (parts[key] ?? 0) * weight, 0);
  return { takenAt, season, dateSource, file: item.file, group: item.group, kind: item.kind, team: item.team, person: item.person, sha256, width, height, sharpness, faces: faces.length, prominent: prominent.length, faceSize, faceSharpness, kitMatch: kit, score: Math.round(total * 100), parts, warnings, previews: {} };
}

async function previews(entry: Scored): Promise<void> {
  const bytes = await sharp(readFileSync(entry.file)).rotate().jpeg({ quality: 95 }).toBuffer();
  const base = entry.sha256.slice(0, 12);
  const save = async (name: string, data: Buffer) => { writeFileSync(path.join(out, `${base}-${name}.jpg`), data); entry.previews[name] = `${base}-${name}.jpg`; };
  await save("orijinal", await sharp(bytes).resize(540, 960, { fit: "inside" }).jpeg({ quality: 82 }).toBuffer());
  const team = entry.team ?? teams[0]!;
  if (entry.kind === "PORTRAIT") {
    const faces = await detectFaces(bytes, `score-${entry.sha256}`);
    const plan = planCrop({ source: { width: entry.width, height: entry.height }, frame: FRAME, safe: SAFE, faces, saliency: null });
    const crop = await cropTo(bytes, plan.box, entry.width, entry.height);
    await save("kesim-odak", crop);
    await save("duotone", await duotone(crop, team));
  } else {
    const saliency = await saliencyPoint(bytes, { width: entry.width, height: entry.height });
    const plan = planCrop({ source: { width: entry.width, height: entry.height }, frame: FRAME, safe: SAFE, faces: [], saliency });
    const crop = await cropTo(bytes, plan.box, entry.width, entry.height);
    await save("bulanik-zemin", await sharp(crop).blur(14).modulate({ brightness: 0.55 }).jpeg({ quality: 80 }).toBuffer());
    await save("duotone", await duotone(await sharp(crop).blur(14).toBuffer(), team));
  }
}

/** fal fiyat ucundan 2026-11-06 doğrulandı: birefnet/v2 ve esrgan 0,000575 USD / işlem saniyesi. */
const FAL_USD_PER_SECOND = 0.000575;
let falSeconds = 0;
let falCalls = 0;

/** `--cutout`: portrede birefnet kesimi (SHA-256 ile önbellekli; aynı dosya ikinci kez gönderilmez), en iyi stadyum zemininde. */
async function cutoutPreview(entry: Scored, backdrop: Buffer | null): Promise<void> {
  const base = entry.sha256.slice(0, 12);
  const cached = path.join(out, `${base}-cutout.png`);
  let cutout: Buffer;
  try {
    cutout = readFileSync(cached);
  } catch {
    const { removePlayerBackground } = await import("@/lib/services/fal");
    const { downloadImage, inspectImageBytes } = await import("@/lib/dashboard/studio-images");
    let bytes: Buffer = await sharp(readFileSync(entry.file)).rotate().jpeg({ quality: 95 }).toBuffer();
    // Kısa kenar < 1080: önce ESRGAN (yüz iyileştirme kapalı), kesim büyütülmüş sürümden. Önbellek kaynak SHA-256 ile.
    const short = Math.min(entry.width, entry.height);
    if (short < 1080) {
      const { falPhotoUpscaler, hasCachedUpscale } = await import("@/lib/dashboard/match-photo/quality");
      const inspected = await inspectImageBytes(bytes, "Fotoğraf");
      if (inspected.ok) {
        const scale = Math.min(4, Math.ceil(1080 / short));
        const fresh = !(await hasCachedUpscale(inspected.data));
        const started = Date.now();
        const upscaled = await falPhotoUpscaler(inspected.data, scale);
        if (fresh) { falSeconds += (Date.now() - started) / 1000; falCalls += 1; }
        if (upscaled.ok) {
          bytes = upscaled.data.bytes;
          writeFileSync(path.join(out, `${base}-buyutulmus.jpg`), bytes);
          console.log(`fal büyütme ${path.basename(entry.file)} ×${scale} → ${upscaled.data.width}×${upscaled.data.height}${fresh ? `, ${((Date.now() - started) / 1000).toFixed(1)} sn` : " (önbellek)"}`);
        } else entry.warnings.push(`büyütme başarısız: ${upscaled.error.message}`);
      }
    }
    const started = Date.now();
    const result = await removePlayerBackground({ bytes, contentType: "image/jpeg" });
    falSeconds += (Date.now() - started) / 1000;
    falCalls += 1;
    if (!result.ok) {
      entry.warnings.push(`Fal kesimi başarısız: ${result.error.message}`);
      return;
    }
    cutout = await downloadImage(result.data.transparentImageUrl);
    writeFileSync(cached, cutout);
    console.log(`fal kesim ${path.basename(entry.file)}: ${((Date.now() - started) / 1000).toFixed(1)} sn (ağ + kuyruk dahil), tahmini ≤ ${(((Date.now() - started) / 1000) * FAL_USD_PER_SECOND).toFixed(4)} USD`);
  }
  const person = await sharp(cutout).resize(540, 800, { fit: "inside" }).png().toBuffer();
  const { width = 540, height = 800 } = await sharp(person).metadata();
  const team = entry.team ?? teams[0]!;
  const ground = backdrop ?? (await sharp({ create: { width: 540, height: 960, channels: 3, background: team.primary } }).jpeg().toBuffer());
  const composed = await sharp(ground).resize(540, 960, { fit: "cover" }).composite([{ input: person, left: Math.round((540 - width) / 2), top: 960 - height }]).jpeg({ quality: 85 }).toBuffer();
  writeFileSync(path.join(out, `${base}-kesim.jpg`), composed);
  entry.previews = { kesim: `${base}-kesim.jpg`, ...entry.previews };
}

const KIND_LABEL: Record<Kind, string> = { PORTRAIT: "Oyuncu portresi (ön plan kesim)", TEAM: "Takım fotoğrafı (takım kartlarında bulanık zemin)", VENUE: "Stadyum (kapak + Monte Carlo bulanık zemin)" };
const escape = (text: string) => text.replace(/[&<>"]/gu, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char] ?? char);

function html(groups: Map<string, Scored[]>): string {
  const sections = [...groups.entries()].map(([group, items]) => {
    const best = items.slice(0, 2);
    const cards = best.map((item, rank) => `
      <article><h3>${rank + 1}. ${escape(path.basename(item.file))} · <b>${item.score}</b>/100</h3>
      <p>${item.width}×${item.height} · netlik ${item.sharpness.toFixed(0)}${item.kind === "PORTRAIT" ? ` · yüz ${item.faceSize} px · belirgin yüz ${item.prominent}` : ""}${item.kitMatch === null ? "" : ` · forma uyumu %${Math.round(item.kitMatch * 100)}`}</p>
      ${item.warnings.length ? `<p class="warn">${item.warnings.map(escape).join("<br>")}</p>` : ""}
      <div class="row">${Object.entries(item.previews).map(([name, file]) => `<figure><img src="${file}"><figcaption>${name}</figcaption></figure>`).join("")}</div></article>`).join("");
    const rest = items.slice(2).map((item) => `<li>${escape(path.basename(item.file))} · ${item.score} · ${item.width}×${item.height}${item.warnings.length ? ` · ${escape(item.warnings.join("; "))}` : ""}</li>`).join("");
    return `<section><h2>${escape(group)} <small>${KIND_LABEL[items[0]!.kind]} · ${items.length} aday</small></h2>${cards}${rest ? `<details><summary>Diğer adaylar</summary><ul>${rest}</ul></details>` : ""}</section>`;
  }).join("");
  return `<!doctype html><html lang="tr"><meta charset="utf-8"><title>Fotoğraf seçimi</title><style>
body{font:15px system-ui;background:#111;color:#eee;margin:16px}h2{border-top:1px solid #444;padding-top:16px}small{color:#999;font-weight:400}
article{margin:12px 0 24px}.row{display:flex;gap:10px;flex-wrap:wrap}figure{margin:0}img{height:360px;border-radius:6px;background:#222}
figcaption{color:#aaa;font-size:13px}.warn{color:#f5b942}</style>
<h1>Galatasaray – Amed SFK · fotoğraf adayları</h1><p>Puan: çözünürlük, netlik, yüz boyutu/netliği, karede tek kişi, forma rengi (takım renkleri). "kesim": Fal birefnet (yalnız portrelerde ilk 2), bulanık stadyum zemininde; diğer önizlemeler yerel. Yüz iyileştirme yok. Final seçimi kullanıcının.</p>${sections}</html>`;
}

const scored: Scored[] = [];
for (const item of entries()) {
  try {
    scored.push(await score(item));
  } catch (cause) {
    console.log(`${item.file}: okunamadı (${cause instanceof Error ? cause.message : "hata"})`);
  }
}
const groups = new Map<string, Scored[]>();
for (const item of scored.sort((a, b) => b.score - a.score)) groups.set(item.group, [...(groups.get(item.group) ?? []), item]);
for (const items of groups.values()) for (const item of items.slice(0, 2)) await previews(item);
if (process.argv.includes("--cutout")) {
  const venue = [...groups.values()].find((items) => items[0]?.kind === "VENUE")?.[0];
  const backdrop = venue ? readFileSync(path.join(out, venue.previews["bulanik-zemin"] ?? "")) : null;
  for (const items of groups.values()) if (items[0]?.kind === "PORTRAIT") for (const item of items.slice(0, 2)) await cutoutPreview(item, backdrop);
  console.log(`fal: ${falCalls} yeni çağrı, ${falSeconds.toFixed(1)} sn, tahmini üst sınır ${(falSeconds * FAL_USD_PER_SECOND).toFixed(4)} USD (fiyat ${FAL_USD_PER_SECOND} USD/işlem sn; süre ağ + kuyruk dahil, gerçek işlem süresi daha kısa)`);
}
writeFileSync(path.join(out, "puanlar.json"), JSON.stringify(scored.map(({ previews: _p, ...rest }) => ({ ...rest, file: path.relative(root, rest.file) })), null, 1));
writeFileSync(path.join(out, "kontak.html"), html(groups));
for (const [group, items] of groups) console.log(`${group}: ${items.map((item) => `${path.basename(item.file)}=${item.score}${item.warnings.length ? "!" : ""}`).join(", ")}`);
console.log(`kontak: ${path.join(out, "kontak.html")}`);
process.exit(0);
