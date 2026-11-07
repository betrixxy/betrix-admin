import { AbsoluteFill, useCurrentFrame } from "remotion";
import { Board } from "./Board";
import { BoardLayer, Lineups, Overlay } from "./beats";
import { beatPresence, cameraAt } from "./camera";
import { Hud } from "./Hud";
import type { TacticalScript } from "./types";

/** "Canlı taktik tahtası" kompozisyonu: saha → beat saha katmanları → beat üst katmanları → sabit HUD. */
export function TacticalReel({ script }: { script: TacticalScript }) {
  const frame = useCurrentFrame();
  const camera = cameraAt(script.beats, frame);
  const visible = script.beats.map((beat, index) => ({ beat, index, presence: beatPresence(beat, script.beats[index + 1], frame) })).filter((item) => item.presence > 0);
  return (
    <AbsoluteFill>
      <Board script={script} camera={camera}>
        <Lineups script={script} dim={0.92} />
        {visible.map(({ beat, index, presence }) => (
          <div key={index} style={{ position: "absolute", inset: 0, opacity: presence }}>
            <BoardLayer script={script} beat={beat} local={frame - beat.from} />
          </div>
        ))}
      </Board>
      {visible.map(({ beat, index, presence }) => (
        <AbsoluteFill key={index} style={{ opacity: presence }}>
          <Overlay script={script} beat={beat} local={frame - beat.from} />
        </AbsoluteFill>
      ))}
      <Hud script={script} />
    </AbsoluteFill>
  );
}
