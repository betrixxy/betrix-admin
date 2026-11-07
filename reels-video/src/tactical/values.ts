import type { Beat } from "./types";

/** Beat değerlerinin okunması: eksik ya da yanlış türde değer render'ı durdurur (bileşen rakam uydurmaz). */
export const num = (beat: Beat, key: string): number => { const value = beat.values[key]; if (typeof value !== "number") throw new Error(`${beat.kind}: ${key} yok`); return value; };
export const text = (beat: Beat, key: string): string => { const value = beat.values[key]; if (typeof value !== "string") throw new Error(`${beat.kind}: ${key} yok`); return value; };
/** İsteğe bağlı metin (ör. oyuncu kesimi yoksa ""). */
export const optText = (beat: Beat, key: string): string => { const value = beat.values[key]; return typeof value === "string" ? value : ""; };
/** İsteğe bağlı kare (ör. ikinci cümle yoksa hiç gelmez). */
export const optNum = (beat: Beat, key: string, fallback: number): number => { const value = beat.values[key]; return typeof value === "number" ? value : fallback; };
