import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { TacticalLayout, UNDER_CSS } from "./audit";
import { Board } from "./Board";
import { BoardLayer, Lineups, Overlay } from "./beats";
import { beatPresence, cameraAt } from "./camera";
import { Hud } from "./Hud";
import { reveal } from "./parts";
import type { TacticalScript } from "./types";

/**
 * "Canlı taktik tahtası" kompozisyonu: saha → beat saha katmanları → beat üst katmanları → sabit HUD. Üst katman paneller saydamlıkla
 * değil açılarak gelir/gider (`reveal`): hiçbir karede yarı saydam panel yok. Kapanışta oyuncu noktaları söner (saha kararır).
 * Her karede kutuya değen oyuncu noktaları gizlenir; `audit`: ayrıca yerleşim denetimi (ihlalde render durur).
 */
/** Kontrast ölçümü için: kutu içindeki yazı, görsel, ikon, çubuk ve çipler gizlenir; panel ve arkası kalır (`contrast.ts`). */
const TEXTLESS_CSS = "[data-box],[data-box] *{color:transparent !important;-webkit-text-fill-color:transparent !important;text-shadow:none !important}[data-box] img,[data-box] svg,[data-box] [data-fill]{visibility:hidden !important}";

export function TacticalReel({ script, audit = false, textless = false }: { script: TacticalScript; audit?: boolean; textless?: boolean }) {
  const frame = useCurrentFrame();
  const camera = cameraAt(script.beats, frame);
  const visible = script.beats.map((beat, index) => ({ beat, index, presence: beatPresence(beat, script.beats[index + 1], frame) })).filter((item) => item.presence > 0);
  const close = script.beats.find((beat) => beat.kind === "close");
  const dots = close ? interpolate(frame, [close.from, close.from + 8], [0.92, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 0.92;
  return (
    <AbsoluteFill data-tactical-root style={{ ["--panel-alpha" as string]: String(script.panelAlpha ?? 0.58) }}>
      <style>{UNDER_CSS}</style>
      {textless ? <style>{TEXTLESS_CSS}</style> : null}
      <Board script={script} camera={camera}>
        {dots > 0.001 ? <Lineups script={script} dim={dots} /> : null}
        {visible.map(({ beat, index, presence }) => (
          <div key={index} style={{ position: "absolute", inset: 0, opacity: presence }}>
            <BoardLayer script={script} beat={beat} local={frame - beat.from} />
          </div>
        ))}
      </Board>
      {visible.map(({ beat, index, presence }) => (
        <AbsoluteFill key={index} style={reveal(presence)}>
          <Overlay script={script} beat={beat} local={frame - beat.from} />
        </AbsoluteFill>
      ))}
      <Hud script={script} />
      <TacticalLayout audit={audit} />
    </AbsoluteFill>
  );
}
