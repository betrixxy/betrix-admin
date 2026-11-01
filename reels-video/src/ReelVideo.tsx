import { linearTiming, TransitionSeries } from "@remotion/transitions";
import type { TransitionPresentation, TransitionPresentationComponentProps } from "@remotion/transitions";
import { Fragment } from "react";
import { AbsoluteFill } from "remotion";
import { AuditProbe, Backdrop, Hud } from "./components/Primitives";
import { TRANSITION_FRAMES, WIDTH } from "./lib/motion";
import type { ReelScene, ReelScript } from "./schema";
import { CompareScene, HeadToHeadScene, KeyGapScene } from "./scenes/compare";
import { ChanceScene, FatigueScene, ScorerScene, ScoreScene, TrackRecordScene } from "./scenes/context";
import { CoverScene, HookScene, LogoScene } from "./scenes/opening";
import { BothScoreScene, FirstGoalScene, GoalsScene, WinnerScene } from "./scenes/outcome";
import { SummaryScene } from "./scenes/summary";

function SceneBody({ scene, script }: { scene: ReelScene; script: ReelScript }) {
  switch (scene.type) {
    case "S01_COVER": return <CoverScene script={script} scene={scene} />;
    case "S02_LOGO": return <LogoScene script={script} scene={scene} />;
    case "S03_HOOK": return <HookScene script={script} scene={scene} />;
    case "S04_COMPARE": return <CompareScene script={script} scene={scene} />;
    case "S05_H2H": return <HeadToHeadScene script={script} scene={scene} />;
    case "S06_WINNER": return <WinnerScene script={script} scene={scene} />;
    case "S07_KEY_GAP": return <KeyGapScene script={script} scene={scene} />;
    case "S08_GOALS": return <GoalsScene script={script} scene={scene} />;
    case "S09_BOTH_SCORE": return <BothScoreScene script={script} scene={scene} />;
    case "S10_FIRST_GOAL": return <FirstGoalScene script={script} scene={scene} />;
    case "S11_FATIGUE": return <FatigueScene script={script} scene={scene} />;
    case "S12_SCORE": return <ScoreScene script={script} scene={scene} />;
    case "S13_SCORER": return <ScorerScene script={script} scene={scene} />;
    case "S14_TRACK_RECORD": return <TrackRecordScene script={script} scene={scene} />;
    case "S15_CHANCE": return <ChanceScene script={script} scene={scene} />;
    case "S16_SUMMARY": return <SummaryScene script={script} scene={scene} />;
  }
}

const BAR_WIDTH = 96;

/** Marka yeşili silme: yeni sahne önde giden yeşil şeridin arkasından açılır. */
function GreenWipe({ children, presentationDirection, presentationProgress, passedProps }: TransitionPresentationComponentProps<{ color: string }>) {
  if (presentationDirection === "exiting") return <AbsoluteFill>{children}</AbsoluteFill>;
  const edge = presentationProgress * (WIDTH + BAR_WIDTH);
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ clipPath: `inset(0 ${Math.max(0, WIDTH - edge + BAR_WIDTH)}px 0 0)` }}>{children}</AbsoluteFill>
      {presentationProgress < 1 ? <div style={{ position: "absolute", top: 0, bottom: 0, left: edge - BAR_WIDTH, width: BAR_WIDTH, background: passedProps.color }} /> : null}
    </AbsoluteFill>
  );
}

const greenWipe = (color: string): TransitionPresentation<{ color: string }> => ({ component: GreenWipe, props: { color } });

/** Zemin ve HUD geçişlerin dışındadır: boş kare olmaz, logo ve çubuk yerinde kalır. */
export function ReelVideo({ script, audit = false }: { script: ReelScript; audit?: boolean }) {
  return (
    <AbsoluteFill data-reel-root="">
      <Backdrop accent={script.brand.accent} />
      <TransitionSeries>
        {script.scenes.map((scene, index) => (
          <Fragment key={scene.type}>
            {index > 0 ? <TransitionSeries.Transition presentation={greenWipe(script.brand.accent)} timing={linearTiming({ durationInFrames: TRANSITION_FRAMES })} /> : null}
            <TransitionSeries.Sequence durationInFrames={scene.durationInFrames}>
              <SceneBody scene={scene} script={script} />
            </TransitionSeries.Sequence>
          </Fragment>
        ))}
      </TransitionSeries>
      <Hud script={script} />
      {audit ? <AuditProbe /> : null}
    </AbsoluteFill>
  );
}
