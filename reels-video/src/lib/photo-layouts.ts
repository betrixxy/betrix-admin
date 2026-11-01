import type { Frame } from "./crop";
import { CONTENT_WIDTH, SAFE, ZONES } from "./motion";
import type { NamedRect } from "./layout-check";

/**
 * Fotoğraf yerleşimleri ve her birinin yanına konan içerik alanları. Yüzün bu alanlara girmediği testle sabittir;
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
const title: NamedRect = { name: "başlık", x: X, y: ZONES.titleTop, width: W, height: 196 };
const strip: NamedRect = { name: "veri şeridi", x: X, y: ZONES.stripTop, width: W, height: ZONES.stripHeight };

const pair = (frame: Frame, top: number, leftA: number, leftB: number): [PhotoSlot, PhotoSlot] => [
  { frame, top, left: leftA, flip: false },
  { frame, top, left: leftB, flip: true },
];

export const LAYOUTS = {
  /** Tam boy iki oyuncu; künye kartı gövdelerin üstünde. */
  cover: { slots: pair({ width: 700, height: 940 }, 500, -90, 470), reserved: [title, strip] },
  /** Sayaç ve skor tablosu üstte, oyuncular altında. */
  duel: {
    slots: pair({ width: 500, height: 560 }, 900, 30, 550),
    reserved: [title, strip, { name: "sayaç ve skorlar", x: X, y: ZONES.mainTop, width: W, height: 380 }],
  },
  /** Oyuncular başlığın altında, nokta ızgarası gövdelerin üstünde. */
  winner: {
    slots: pair({ width: 460, height: 420 }, 500, -10, 630),
    reserved: [title, { name: "nokta ızgarası", x: X, y: 880, width: W, height: 350 }, { name: "yüzdeler", x: X, y: 1240, width: W, height: 192 }],
  },
  /** Tek oyuncu sağda; sol sütunda büyük rakam, altta tam genişlik kart. */
  feature: {
    slots: [{ frame: { width: 560, height: 760 }, top: 500, left: 490, flip: true }] as [PhotoSlot],
    reserved: [title, strip, { name: "sol sütun", x: X, y: ZONES.mainTop, width: 580, height: 370 }, { name: "alt kart", x: X, y: 900, width: W, height: 362 }],
  },
} as const satisfies Record<string, PhotoLayout>;
