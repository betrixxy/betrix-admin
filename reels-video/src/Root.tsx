import { loadFont } from "@remotion/fonts";
import { Composition, staticFile } from "remotion";
import { FONT_FILES } from "./components/typography";
import { buildTimeline, FPS, HEIGHT, WIDTH } from "./lib/motion";
import { ReelVideo } from "./ReelVideo";
import { boardScript, flowScript, SAMPLE_KEYS, sampleScripts, singleSceneScript } from "./samples";
import { DESIGN_DIRECTIONS } from "./schema";
import { TypographyTest } from "./TypographyTest";

for (const font of FONT_FILES) {
  void loadFont({ family: font.family, url: staticFile(`fonts/${font.file}`), weight: font.weight, ...("style" in font ? { style: font.style } : {}) });
}

/** `reel-*`: seçilen hikâye (MP4). `havuz-*`: bütün sahneler (tek kareler). `pano-*`: tasarım yönü panosu. `akis`: aktif temada tam akış. `monte-carlo`: tek sahne MP4. `tipografi`: font test karesi. */
export function Root() {
  const first = SAMPLE_KEYS[0];
  return (
    <>
      {[
        ...SAMPLE_KEYS.flatMap((key) => {
          const { story, pool } = sampleScripts(key);
          return [{ id: `reel-${key}`, script: story }, { id: `havuz-${key}`, script: pool }];
        }),
        ...DESIGN_DIRECTIONS.map((direction) => ({ id: `pano-${direction}`, script: boardScript(direction) })),
        { id: "akis", script: flowScript() },
        { id: "monte-carlo", script: singleSceneScript("M02_MONTE_CARLO") },
      ].map(({ id, script }) => (
        <Composition
          key={id}
          id={id}
          component={ReelVideo}
          width={WIDTH}
          height={HEIGHT}
          fps={FPS}
          durationInFrames={buildTimeline(script.scenes.map((scene) => scene.durationInFrames)).total}
          defaultProps={{ script, audit: false, strictSafe: false, maskText: false, videoRules: false }}
        />
      ))}
      {first ? <Composition id="tipografi" component={TypographyTest} width={WIDTH} height={HEIGHT} fps={FPS} durationInFrames={1} defaultProps={{ script: sampleScripts(first).pool }} /> : null}
    </>
  );
}
