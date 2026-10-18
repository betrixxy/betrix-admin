import { readFile } from "node:fs/promises";
import path from "node:path";
import * as ort from "onnxruntime-web";
import sharp from "sharp";
import { readStoredFile, saveStoredFile } from "@/lib/dashboard/storage";

/**
 * Yerel yüz tespiti — YuNet (OpenCV Zoo, MIT; `assets/models/`) + onnxruntime-web (WASM).
 * Native derleme yok: Alpine Docker imajında ve Windows'ta aynı çalışır, ağ çağrısı/ücret yok.
 * Model 640×640 sabit girdi alır; tam kadraj maç fotoğrafında yüzler küçük olduğu için görsel
 * hem bütün olarak hem de örtüşen karolar hâlinde taranır, sonuçlar NMS ile birleştirilir.
 * Sonuç fotoğrafın SHA-256'sıyla önbelleğe alınır (`storage/generated/faces-<hash>.json`).
 */

export interface FaceBox {
  x: number;
  y: number;
  width: number;
  height: number;
  score: number;
}

const MODEL_PATH = path.join(process.cwd(), "assets", "models", "face_detection_yunet_2023mar.onnx");
const INPUT = 640;
const STRIDES = [8, 16, 32] as const;
/**
 * Kalibrasyon (gerçek maç fotoğrafları, 2026-10-18): gerçek yüzler 0.79-0.91, yanlış pozitifler
 * (yumruk, omuz, yüzün içindeki ikinci kutu) 0.65-0.69.
 */
export const FACE_SCORE_THRESHOLD = 0.75;
const NMS_IOU = 0.3;
/** Küçük kutunun bu oranından fazlası büyük kutunun içindeyse aynı yüz sayılır (iç içe kutular). */
const NMS_CONTAINMENT = 0.6;
/** Eşik/NMS değişince eski önbellek sonuçları kullanılmasın. */
const CACHE_VERSION = 2;
/** Bu kısa kenarın üstündeki görseller karolara bölünür. */
const TILE_FROM = 900;
const MAX_TILES = 12;

let session: Promise<ort.InferenceSession> | null = null;

function getSession(): Promise<ort.InferenceSession> {
  ort.env.wasm.numThreads = 1;
  session ??= readFile(MODEL_PATH).then((model) => ort.InferenceSession.create(model));
  return session;
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/**
 * YuNet çıktısı → girdi pikselinde yüz kutuları (OpenCV `FaceDetectorYN` çözümüyle aynı):
 * skor = √(cls·obj); merkez = (hücre + Δ)·adım; boyut = e^Δ·adım.
 */
export function decodeYunet(outputs: Record<string, Float32Array>, threshold = FACE_SCORE_THRESHOLD): FaceBox[] {
  const faces: FaceBox[] = [];
  for (const stride of STRIDES) {
    const cls = outputs[`cls_${stride}`];
    const obj = outputs[`obj_${stride}`];
    const bbox = outputs[`bbox_${stride}`];
    if (!cls || !obj || !bbox) continue;
    const cols = INPUT / stride;
    for (let i = 0; i < cls.length; i++) {
      const score = Math.sqrt(clamp01(cls[i] ?? 0) * clamp01(obj[i] ?? 0));
      if (score < threshold) continue;
      const col = i % cols;
      const row = (i - col) / cols;
      const cx = (col + (bbox[i * 4] ?? 0)) * stride;
      const cy = (row + (bbox[i * 4 + 1] ?? 0)) * stride;
      const width = Math.exp(bbox[i * 4 + 2] ?? 0) * stride;
      const height = Math.exp(bbox[i * 4 + 3] ?? 0) * stride;
      faces.push({ x: cx - width / 2, y: cy - height / 2, width, height, score });
    }
  }
  return faces;
}

function overlap(a: FaceBox, b: FaceBox): { iou: number; containment: number } {
  const w = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  if (w <= 0 || h <= 0) return { iou: 0, containment: 0 };
  const inter = w * h;
  const areaA = a.width * a.height;
  const areaB = b.width * b.height;
  return { iou: inter / (areaA + areaB - inter), containment: inter / Math.min(areaA, areaB) };
}

/** Skora göre azalan NMS: çakışan (IoU > eşik) ya da büyüğün içinde kalan kutular elenir. */
export function nms(faces: FaceBox[], threshold = NMS_IOU): FaceBox[] {
  const kept: FaceBox[] = [];
  for (const face of [...faces].sort((a, b) => b.score - a.score)) {
    const clashes = kept.some((other) => {
      const { iou, containment } = overlap(face, other);
      return iou > threshold || containment > NMS_CONTAINMENT;
    });
    if (!clashes) kept.push(face);
  }
  return kept;
}

interface Region {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Bütün görsel + (büyükse) yarım-kısa-kenar boyutlu, %40 örtüşen kare karolar. */
export function scanRegions(width: number, height: number): Region[] {
  const regions: Region[] = [{ left: 0, top: 0, width, height }];
  if (Math.min(width, height) < TILE_FROM) return regions;
  const size = Math.round(Math.min(width, height) / 2);
  const step = Math.round(size * 0.6);
  const starts = (span: number) => {
    const list: number[] = [];
    for (let at = 0; at + size < span; at += step) list.push(at);
    list.push(span - size);
    return list;
  };
  for (const top of starts(height)) for (const left of starts(width)) regions.push({ left, top, width: size, height: size });
  return regions.slice(0, MAX_TILES + 1);
}

/** Bölgeyi 640×640'a (oran korunur, sağ/alt siyah dolgu) BGR, NCHW float32 olarak hazırlar. */
async function toInput(bytes: Buffer, region: Region): Promise<{ tensor: ort.Tensor; scale: number }> {
  const scale = INPUT / Math.max(region.width, region.height);
  const width = Math.min(INPUT, Math.round(region.width * scale));
  const height = Math.min(INPUT, Math.round(region.height * scale));
  // sharp tek zincirde extract'ı extend'den önce uygular — dolgu ayrı adımda.
  const resized = await sharp(bytes).extract(region).resize(width, height, { fit: "fill" }).removeAlpha().raw().toBuffer();
  const data = await sharp(resized, { raw: { width, height, channels: 3 } })
    .extend({ right: INPUT - width, bottom: INPUT - height, background: "#000" })
    .raw()
    .toBuffer();
  const plane = INPUT * INPUT;
  const input = new Float32Array(3 * plane);
  for (let i = 0; i < plane; i++) {
    input[i] = data[i * 3 + 2] ?? 0; // B
    input[plane + i] = data[i * 3 + 1] ?? 0; // G
    input[2 * plane + i] = data[i * 3] ?? 0; // R
  }
  return { tensor: new ort.Tensor("float32", input, [1, 3, INPUT, INPUT]), scale };
}

async function detectInRegion(model: ort.InferenceSession, bytes: Buffer, region: Region): Promise<FaceBox[]> {
  const { tensor, scale } = await toInput(bytes, region);
  const result = await model.run({ input: tensor });
  const outputs: Record<string, Float32Array> = {};
  for (const [name, value] of Object.entries(result)) if (value.data instanceof Float32Array) outputs[name] = value.data;
  return decodeYunet(outputs).map((face) => ({
    x: region.left + face.x / scale,
    y: region.top + face.y / scale,
    width: face.width / scale,
    height: face.height / scale,
    score: face.score,
  }));
}

/** Fotoğraftaki yüzler (kaynak pikseli, EXIF yönü uygulanmış), skora göre azalan. */
export async function detectFaces(bytes: Buffer, hash: string): Promise<FaceBox[]> {
  const cacheName = `faces-v${CACHE_VERSION}-${hash}.json`;
  const cached = await readStoredFile("generated", cacheName);
  if (cached) return JSON.parse(cached.toString("utf8")) as FaceBox[];

  // EXIF yönü bir kez uygulanır; karolar bu dik kopyadan kesilir (kırpma da aynı yönle çalışır).
  const upright = await sharp(bytes).rotate().jpeg({ quality: 95 }).toBuffer({ resolveWithObject: true });
  const model = await getSession();
  const found: FaceBox[] = [];
  for (const region of scanRegions(upright.info.width, upright.info.height)) {
    found.push(...(await detectInRegion(model, upright.data, region)));
  }
  const faces = nms(found);
  await saveStoredFile("generated", cacheName, Buffer.from(JSON.stringify(faces)));
  return faces;
}
