import { linearTiming, TransitionSeries } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { Fragment } from "react";
import { AbsoluteFill } from "remotion";
import { Backdrop, Signature } from "./components/Primitives";
import { TRANSITION_FRAMES } from "./lib/motion";
import type { ReelScene, ReelScript } from "./schema";
import { CloseScene, CoverScene, FirstGoalScene, GoalsScene, HookScene, LogoScene, ChanceNoteScene, PromptScene, WinnerScene } from "./scenes/Scenes";

function SceneBody({ scene, script }: { scene: ReelScene; script: ReelScript }) {
  const common = { script, accent: script.brand.accent };
  switch (scene.type) {
    case "K0_COVER": return <CoverScene {...common} scene={scene} />;
    case "K1_LOGO": return <LogoScene {...common} />;
    case "M1_HOOK": return <HookScene {...common} scene={scene} />;
    case "M3_WINNER": return <WinnerScene {...common} scene={scene} />;
    case "M4_GOALS": return <GoalsScene {...common} scene={scene} />;
    case "M6_FIRST_GOAL": return <FirstGoalScene {...common} scene={scene} />;
    case "K9_CHANCE_NOTE": return <ChanceNoteScene {...common} scene={scene} />;
    case "K11_PROMPT": return <PromptScene {...common} scene={scene} />;
    case "K12_CLOSE": return <CloseScene {...common} scene={scene} />;
  }
}

/** Zemin ve imza geçişlerin dışındadır: boş kare olmaz, logo hep aynı yerde kalır. */
export function ReelVideo({ script }: { script: ReelScript }) {
  return (
    <AbsoluteFill>
      <Backdrop accent={script.brand.accent} />
      <TransitionSeries>
        {script.scenes.map((scene, index) => (
          <Fragment key={scene.type}>
            {index > 0 ? <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: TRANSITION_FRAMES })} /> : null}
            <TransitionSeries.Sequence durationInFrames={scene.durationInFrames}>
              <SceneBody scene={scene} script={script} />
            </TransitionSeries.Sequence>
          </Fragment>
        ))}
      </TransitionSeries>
      <Signature logo={script.brand.logo} />
    </AbsoluteFill>
  );
}
