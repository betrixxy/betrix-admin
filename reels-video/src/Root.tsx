import { loadFont } from "@remotion/fonts";
import { Composition, staticFile } from "remotion";
import { FONT_FAMILY } from "./components/Primitives";
import { buildTimeline, FPS, HEIGHT, WIDTH } from "./lib/motion";
import { ReelVideo } from "./ReelVideo";
import { SAMPLE_KEYS, sampleScripts } from "./samples";

for (const [file, weight] of [["Geist-Regular.ttf", "500"], ["Geist-Bold.ttf", "700"], ["Geist-Black.ttf", "900"]] as const) {
  void loadFont({ family: FONT_FAMILY, url: staticFile(`fonts/${file}`), weight });
}

/** `reel-*`: seçilen hikâye (MP4). `havuz-*`: 16 sahnenin tamamı (tek kareler). */
export function Root() {
  return (
    <>
      {SAMPLE_KEYS.flatMap((key) => {
        const { story, pool } = sampleScripts(key);
        return [
          { id: `reel-${key}`, script: story },
          { id: `havuz-${key}`, script: pool },
        ];
      }).map(({ id, script }) => (
        <Composition
          key={id}
          id={id}
          component={ReelVideo}
          width={WIDTH}
          height={HEIGHT}
          fps={FPS}
          durationInFrames={buildTimeline(script.scenes.map((scene) => scene.durationInFrames)).total}
          defaultProps={{ script, audit: false }}
        />
      ))}
    </>
  );
}
