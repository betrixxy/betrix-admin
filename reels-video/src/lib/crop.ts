import type { ReelCropBox, ReelPhoto } from "../schema";

/**
 * Kırpma render anında yapılır (arşiv nötr kalır): `Photo.processingMeta` içindeki oransal kırpma önerisini
 * verilen çerçeveye yerleştirir. Saf; dönen değerler çerçeveye göre piksel.
 */

export interface Frame {
  width: number;
  height: number;
}

export interface Placement {
  width: number;
  height: number;
  left: number;
  top: number;
}

/** Çerçevenin en/boy oranına en yakın önerilen kırpma: dikey çerçeveye dikey, diğerlerine kare. */
export const cropFor = (photo: Pick<ReelPhoto, "crops">, frame: Frame): ReelCropBox =>
  frame.height / frame.width >= 1.3 ? photo.crops.vertical : photo.crops.square;

/** Kırpma kutusu çerçeveyi kaplayacak şekilde görselin boyutu ve konumu. */
export function placeCrop(crop: ReelCropBox, aspect: number, frame: Frame): Placement {
  const scale = Math.max(frame.width / crop.width, (frame.height / crop.height) * aspect);
  const width = scale;
  const height = scale / aspect;
  const left = (frame.width - crop.width * width) / 2 - crop.x * width;
  const top = (frame.height - crop.height * height) / 2 - crop.y * height;
  return { width, height, left, top };
}

/** Odak noktasının çerçevedeki konumu (yavaş zoom bu noktayı merkez alır); yüzde. */
export function focusOrigin(photo: Pick<ReelPhoto, "focus" | "aspect" | "crops">, frame: Frame): { x: number; y: number } {
  const place = placeCrop(cropFor(photo, frame), photo.aspect, frame);
  return {
    x: ((place.left + photo.focus.x * place.width) / frame.width) * 100,
    y: ((place.top + photo.focus.y * place.height) / frame.height) * 100,
  };
}
