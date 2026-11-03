import { linearTiming, TransitionSeries } from "@remotion/transitions";
import type { TransitionPresentation, TransitionPresentationComponentProps } from "@remotion/transitions";
import { Fragment } from "react";
import { AbsoluteFill } from "remotion";
import { AuditProbe } from "./components/Primitives";
import { StageBackdrop, StageHud, themeOf } from "./design/kit";
import { TRANSITION_FRAMES, WIDTH } from "./lib/motion";
import type { ReelScene, ReelScript } from "./schema";
import { CompareScene, HeadToHeadScene, KeyGapScene } from "./scenes/compare";
import { ChanceScene, FatigueScene, TrackRecordScene } from "./scenes/context";
import { HookScene, LogoScene } from "./scenes/opening";
import { DuelScene, StageCover, VsOpponentScene } from "./scenes/players";
import { QuestionScene } from "./scenes/question";
import { AbsencesScene, FormScene, StoryScene } from "./scenes/reading";
import { MinutesScene, TeamScene } from "./scenes/team";
import { CloseScene, KeyScene, ScenarioScene, UpsetScene } from "./scenes/verdict";
import { MonteCarloScene } from "./scenes/montecarlo";
import { SummaryScene } from "./scenes/summary";

function SceneBody({ scene, script }: { scene: ReelScene; script: ReelScript }) {
  switch (scene.type) {
    case "S01_COVER": return <StageCover script={script} scene={scene} />;
    case "S02_LOGO": return <LogoScene script={script} scene={scene} />;
    case "S03_HOOK": return <HookScene script={script} scene={scene} />;
    case "M02_MONTE_CARLO": return <MonteCarloScene script={script} scene={scene} />;
    case "C01_STORY": return <StoryScene script={script} scene={scene} />;
    case "C02_FORM": return <FormScene script={script} scene={scene} />;
    case "C03_ABSENCES": return <AbsencesScene script={script} scene={scene} />;
    case "C04_TEAM_HOME": case "C05_TEAM_AWAY": return <TeamScene script={script} scene={scene} />;
    case "C06_MINUTES": return <MinutesScene script={script} scene={scene} />;
    case "C07_KEY": return <KeyScene script={script} scene={scene} />;
    case "C08_UPSET": return <UpsetScene script={script} scene={scene} />;
    case "C09_SCENARIO": return <ScenarioScene script={script} scene={scene} />;
    case "S17_CLOSE": return <CloseScene script={script} scene={scene} />;
    case "S04_COMPARE": return <CompareScene script={script} scene={scene} />;
    case "S05_H2H": return <HeadToHeadScene script={script} scene={scene} />;
    case "S07_KEY_GAP": return <KeyGapScene script={script} scene={scene} />;
    case "S11_FATIGUE": return <FatigueScene script={script} scene={scene} />;
    case "S14_TRACK_RECORD": return <TrackRecordScene script={script} scene={scene} />;
    case "S15_CHANCE": return <ChanceScene script={script} scene={scene} />;
    case "S16_SUMMARY": return <SummaryScene script={script} scene={scene} />;
    case "P01_DUEL": return <DuelScene script={script} scene={scene} />;
    case "P02_VS_OPPONENT": return <VsOpponentScene script={script} scene={scene} />;
    default: return <QuestionScene script={script} scene={scene} />;
  }
}

const BAR_WIDTH = 96;

/** Vurgu rengi silme: yeni sahne önde giden şeridin arkasından açılır. */
function GreenWipe({ children, presentationDirection, presentationProgress, passedProps }: TransitionPresentationComponentProps<{ color: string }>) {
  const edge = presentationProgress * (WIDTH + BAR_WIDTH);
  // Sahnelerin kendi zemini yok (zemin ortak): eski sahne de kırpılır, yoksa yeni sahnenin içinden görünür.
  if (presentationDirection === "exiting") return <AbsoluteFill style={{ clipPath: `inset(0 0 0 ${Math.max(0, edge - BAR_WIDTH)}px)` }}>{children}</AbsoluteFill>;
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ clipPath: `inset(0 ${Math.max(0, WIDTH - edge + BAR_WIDTH)}px 0 0)` }}>{children}</AbsoluteFill>
      {presentationProgress < 1 ? <div style={{ position: "absolute", top: 0, bottom: 0, left: edge - BAR_WIDTH, width: BAR_WIDTH, background: passedProps.color }} /> : null}
    </AbsoluteFill>
  );
}

const greenWipe = (color: string): TransitionPresentation<{ color: string }> => ({ component: GreenWipe, props: { color } });

/** Metni gizler: kontrast ölçümü metnin arkasındaki pikseli okur. */
const MASK_CSS = "[data-reel-root] * { color: transparent !important; -webkit-text-fill-color: transparent !important; text-shadow: none !important; }";

/** Zemin ve HUD geçişlerin dışındadır: boş kare olmaz, logo ve çubuk yerinde kalır. */
export function ReelVideo({ script, audit = false, strictSafe = false, maskText = false }: { script: ReelScript; audit?: boolean; strictSafe?: boolean; maskText?: boolean }) {
  const accent = themeOf(script).accent;
  return (
    <AbsoluteFill data-reel-root="" data-safe={strictSafe ? "strict" : "legacy"} data-mono-words={themeOf(script).monoWordsAllowed ? "ok" : "no"} lang="tr">
      {maskText ? <style>{MASK_CSS}</style> : null}
      <StageBackdrop script={script} />
      <TransitionSeries>
        {script.scenes.map((scene, index) => (
          <Fragment key={scene.type}>
            {index > 0 ? <TransitionSeries.Transition presentation={greenWipe(accent)} timing={linearTiming({ durationInFrames: TRANSITION_FRAMES })} /> : null}
            <TransitionSeries.Sequence durationInFrames={scene.durationInFrames}>
              <SceneBody scene={scene} script={script} />
            </TransitionSeries.Sequence>
          </Fragment>
        ))}
      </TransitionSeries>
      <StageHud script={script} />
      {audit ? <AuditProbe /> : null}
    </AbsoluteFill>
  );
}
