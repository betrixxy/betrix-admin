import { execFileSync } from "node:child_process";
import sharp from "sharp";
import { FFMPEG, FFPROBE } from "./audio-track";

/**
 * Render sonrası denetim (kalite kuralları 11-06): kodlama etiketleri ffprobe'dan; seçili karelerde MP4'ten çözülen kare, kayıpsız
 * PNG ile karşılaştırılır — metin bölgesinde netlik oranı ve marka yeşilinin renk sapması (ΔE, CIE76).
 */

interface Stream { codec_type: string; codec_name: string; profile?: string; width?: number; height?: number; r_frame_rate?: string; pix_fmt?: string; color_space?: string; color_primaries?: string; color_transfer?: string; bit_rate?: string; sample_rate?: string; channels?: number }

export function probe(file: string) {
  const json = JSON.parse(execFileSync(FFPROBE, ["-v", "error", "-print_format", "json", "-show_streams", "-show_format", file], { encoding: "utf8" })) as { streams: Stream[]; format: { duration: string; bit_rate: string; size: string } };
  const video = json.streams.find((stream) => stream.codec_type === "video");
  const audio = json.streams.find((stream) => stream.codec_type === "audio");
  const problems: string[] = [];
  // ffprobe bu derlemede profili sayıyla yazar: 100 = High.
  if (!video || video.codec_name !== "h264" || !["High", "100"].includes(video.profile ?? "")) problems.push(`video: h264 High değil (${video?.codec_name} ${video?.profile})`);
  if (video?.width !== 1080 || video.height !== 1920) problems.push(`boyut ${video?.width}×${video?.height}`);
  if (video?.r_frame_rate !== "30/1") problems.push(`kare hızı ${video?.r_frame_rate}`);
  if (video?.pix_fmt !== "yuv420p") problems.push(`piksel biçimi ${video?.pix_fmt}`);
  if (video?.color_space !== "bt709" || video.color_primaries !== "bt709" || video.color_transfer !== "bt709") problems.push(`renk etiketi ${video?.color_space}/${video?.color_primaries}/${video?.color_transfer}`);
  const videoMbps = Number(video?.bit_rate ?? 0) / 1e6;
  if (videoMbps < 9) problems.push(`video bit hızı ${videoMbps.toFixed(1)} Mbps (< 9)`);
  if (!audio || audio.codec_name !== "aac" || audio.sample_rate !== "48000" || audio.channels !== 2) problems.push(`ses: ${audio?.codec_name} ${audio?.sample_rate} Hz ${audio?.channels} kanal`);
  const audioKbps = Number(audio?.bit_rate ?? 0) / 1000;
  if (audioKbps < 170) problems.push(`ses bit hızı ${audioKbps.toFixed(0)} kbps`);
  return { problems, seconds: Number(json.format.duration), megabytes: Number(json.format.size) / 1024 / 1024, videoMbps: Number(videoMbps.toFixed(2)), audioKbps: Math.round(audioKbps), profile: video?.profile ?? null };
}

/** MP4'ten tek kare (kare numarasıyla, kesin). */
export function extractFrame(file: string, frame: number, output: string): void {
  // Çıkış tarafında -ss: girdi baştan çözülür, zamanı ≥ t olan ilk kare alınır (kare-doğru). Kare n'in zamanı n/30; 1 ms öncesi.
  const seconds = Math.max(0, frame / 30 - 0.001).toFixed(3);
  execFileSync(FFMPEG, ["-hide_banner", "-loglevel", "error", "-y", "-i", file, "-ss", seconds, "-frames:v", "1", output], { stdio: ["ignore", "ignore", "inherit"] });
}

type Box = { x: number; y: number; width: number; height: number };

async function grey(file: string) {
  const { data, info } = await sharp(file).removeAlpha().greyscale().raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

function laplacian(image: { data: Buffer; width: number; height: number }, boxes: readonly Box[]): number {
  let sum = 0, square = 0, count = 0;
  const at = (x: number, y: number) => image.data[y * image.width + x] ?? 0;
  for (const box of boxes) {
    for (let y = Math.max(1, Math.floor(box.y)); y < Math.min(image.height - 1, Math.ceil(box.y + box.height)); y += 1) {
      for (let x = Math.max(1, Math.floor(box.x)); x < Math.min(image.width - 1, Math.ceil(box.x + box.width)); x += 1) {
        const value = 4 * at(x, y) - at(x - 1, y) - at(x + 1, y) - at(x, y - 1) - at(x, y + 1);
        sum += value; square += value * value; count += 1;
      }
    }
  }
  return count ? square / count - (sum / count) ** 2 : 0;
}

/** sRGB → CIE Lab (D65). */
function lab(r: number, g: number, b: number): [number, number, number] {
  const lin = (value: number) => { const c = value / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  const [R, G, B] = [lin(r), lin(g), lin(b)];
  const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
  const x = f((0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047), y = f(0.2126 * R + 0.7152 * G + 0.0722 * B), z = f((0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}
const deltaE = (a: [number, number, number], b: [number, number, number]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/**
 * Marka yeşili renk sapması: PNG'de yeşile yakın (ΔE < 12) VE 5×5 komşuluğu da yeşil olan iç pikseller (düz yeşil alan), MP4
 * karesinde aynı yerde ortalama renklerin ΔE'si. Kenar ve ince çizgi sayılmaz: 4:2:0 renk örneklemesi kenarda rengi her zaman
 * kaydırır, bu sapma ölçüsü değil; ölçülen, kodlamanın rengi (matris/aralık) kaydırıp kaydırmadığıdır.
 */
async function greenShift(png: string, decoded: string, accent: string): Promise<{ deltaE: number | null; pixels: number }> {
  const target = lab(...([1, 3, 5].map((at) => Number.parseInt(accent.slice(at, at + 2), 16)) as [number, number, number]));
  const [first, second] = await Promise.all([png, decoded].map((file) => sharp(file).removeAlpha().raw().toBuffer({ resolveWithObject: true })));
  if (!first || !second || first.data.length !== second.data.length) return { deltaE: null, pixels: 0 };
  const { width, height } = first.info;
  const a = first.data, b = second.data;
  const near = new Uint8Array(width * height);
  for (let p = 0; p < width * height; p += 1) near[p] = deltaE(lab(a[p * 3] ?? 0, a[p * 3 + 1] ?? 0, a[p * 3 + 2] ?? 0), target) < 12 ? 1 : 0;
  const interior = (x: number, y: number) => {
    for (let dy = -2; dy <= 2; dy += 1) for (let dx = -2; dx <= 2; dx += 1) if (!near[(y + dy) * width + (x + dx)]) return false;
    return true;
  };
  const sumA = [0, 0, 0], sumB = [0, 0, 0];
  let pixels = 0;
  for (let y = 2; y < height - 2; y += 2) for (let x = 2; x < width - 2; x += 2) {
    if (!near[y * width + x] || !interior(x, y)) continue;
    const at = (y * width + x) * 3;
    const source = lab(a[at] ?? 0, a[at + 1] ?? 0, a[at + 2] ?? 0);
    const coded = lab(b[at] ?? 0, b[at + 1] ?? 0, b[at + 2] ?? 0);
    for (let c = 0; c < 3; c += 1) { sumA[c] = (sumA[c] ?? 0) + (source[c] ?? 0); sumB[c] = (sumB[c] ?? 0) + (coded[c] ?? 0); }
    pixels += 1;
  }
  if (pixels < 50) return { deltaE: null, pixels };
  const mean = (sum: number[]) => sum.map((value) => value / pixels) as [number, number, number];
  return { deltaE: Number(deltaE(mean(sumA), mean(sumB)).toFixed(2)), pixels };
}

export async function compareFrame(png: string, decoded: string, textBoxes: readonly Box[], accent: string) {
  const [source, coded] = await Promise.all([grey(png), grey(decoded)]);
  const reference = laplacian(source, textBoxes);
  const sharpness = reference > 0 ? Number((laplacian(coded, textBoxes) / reference).toFixed(3)) : null;
  return { sharpness, green: await greenShift(png, decoded, accent) };
}
