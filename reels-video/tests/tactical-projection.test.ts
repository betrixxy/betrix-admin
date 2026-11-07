import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { playerPoint } from "../src/tactical/Board";
import { dotRect } from "../src/tactical/projection";
import type { TacticalPlayer } from "../src/tactical/types";

/** Tarayıcıda ölçülen gerçek nokta kutuları (Chrome, kare 360, gol beat'i kamerası; 2026-11-07) — CSS 3D hesabı birebir tutmalı. */
const camera = { tilt: 52, zoom: 1.25, panX: 0, panY: 520, rotate: 0 };
const player = (line: number, column: number, lines: number, columns: number): TacticalPlayer => ({ id: 1, name: "x", number: 1, line, column, lines, columns, out: false });

describe("taktik tahtası izdüşümü", () => {
  const cases: [string, TacticalPlayer, "home" | "away", [number, number, number, number]][] = [
    ["ev kalecisi (perspektifte en yakın)", player(1, 1, 5, 1), "home", [472, 2502, 136, 192]],
    ["ev forveti", player(5, 1, 5, 1), "home", [494, 1536, 91, 88]],
    ["deplasman kalecisi (en uzak)", player(1, 1, 5, 1), "away", [508, 926, 64, 44]],
    ["deplasman forveti", player(5, 1, 5, 1), "away", [499, 1354, 83, 73]],
  ];
  for (const [name, item, side, dom] of cases) {
    it(name, () => {
      const rect = dotRect(camera, playerPoint(item, side));
      [rect.x, rect.y, rect.w, rect.h].forEach((value, index) => assert.ok(Math.abs(value - (dom[index] ?? 0)) <= 1.5, `${name}: ${value} ≠ ${dom[index]}`));
    });
  }
});
