import type { Frame } from "./crop";
import { CONTENT_WIDTH, SAFE, ZONES } from "./motion";
import type { NamedRect } from "./layout-check";

/**
 * Fotoğraf yerleşimleri (kadraj güvenli alana bağlı değil, tuvalin altına kadar iner) ve içerik alanları. Yüzün bu alanlara girmediği testle sabittir;
 * render sırasında gerçek DOM kutuları ayrıca ölçülür (`dom-audit.ts`).
 */

export interface PhotoSlot {
  frame: Frame;
  left: number;
  top: number;
  flip: boolean;
}

export interface PhotoLayout {
  slots: readonly PhotoSlot[];
  reserved: readonly NamedRect[];
}

const X = SAFE.left;
const W = CONTENT_WIDTH;
const title: NamedRect = { name: "başlık", x: X, y: ZONES.titleTop, width: W, height: 190 };
const strip: NamedRect = { name: "veri şeridi", x: X, y: ZONES.stripTop, width: W, height: ZONES.stripHeight };

const pair = (frame: Frame, top: number, leftA: number, leftB: number): [PhotoSlot, PhotoSlot] => [
  { frame, top, left: leftA, flip: false },
  { frame, top, left: leftB, flip: true },
];

export const LAYOUTS = {
  /** Tam boy iki oyuncu; künye kartı gövdelerin üstünde. */
  cover: { slots: pair({ width: 1065, height: 1420 }, 500, -252, 267), reserved: [title, strip] },
  /** Sayaç ve skor tablosu üstte, oyuncular altında. */
  duel: {
    slots: pair({ width: 765, height: 1020 }, 900, -102, 418),
    reserved: [title, strip, { name: "sayaç ve skorlar", x: X, y: ZONES.mainTop, width: W, height: 380 }],
  },
  /** Oyuncular başlığın altında, nokta ızgarası gövdelerin üstünde. */
  winner: {
    slots: pair({ width: 460, height: 420 }, 500, -10, 630),
    reserved: [title, { name: "nokta ızgarası", x: X, y: 880, width: W, height: 350 }, { name: "yüzdeler", x: X, y: 1240, width: W, height: 235 }],
  },
  /** Tek oyuncu sağda; sol sütunda büyük rakam, altta tam genişlik kart. */
  feature: {
    slots: [{ frame: { width: 825, height: 1100 }, top: 500, left: 407, flip: true }] as [PhotoSlot],
    reserved: [title, strip, { name: "sol sütun", x: X, y: ZONES.mainTop, width: 580, height: 370 }, { name: "alt kart", x: X, y: 900, width: W, height: 400 }],
  },
} as const satisfies Record<string, PhotoLayout>;
