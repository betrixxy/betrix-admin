import { loadFont } from "@remotion/fonts";
import { Composition, staticFile } from "remotion";
import { FONT_FAMILY } from "./components/Primitives";
import { buildTimeline, FPS, HEIGHT, WIDTH } from "./lib/motion";
import { ReelVideo } from "./ReelVideo";
import { SAMPLES } from "./samples";

for (const [file, weight] of [["Geist-Regular.ttf", "500"], ["Geist-Bold.ttf", "700"], ["Geist-Black.ttf", "900"]] as const) {
  void loadFont({ family: FONT_FAMILY, url: staticFile(`fonts/${file}`), weight });
}

export function Root() {
  return (
    <>
      {Object.entries(SAMPLES).map(([id, script]) => (
        <Composition
          key={id}
          id={id}
          component={ReelVideo}
          width={WIDTH}
          height={HEIGHT}
          fps={FPS}
          durationInFrames={buildTimeline(script.scenes.map((scene) => scene.durationInFrames)).total}
          defaultProps={{ script }}
        />
      ))}
    </>
  );
}
