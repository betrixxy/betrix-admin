import { flowScript } from "../src/samples";
import { screenBullets } from "../src/story/readability";
import { wordCount } from "../src/story/speech";

/** Akışın metni: ekrandaki maddeler ve seslendirme. Render yok, hafif. */
const script = flowScript();
for (const scene of script.scenes) {
  console.log(`\n${scene.type} (${scene.durationInFrames / 30} sn, ${wordCount(scene.voiceover?.text ?? "")} sözcük)`);
  for (const bullet of screenBullets(scene)) console.log(`  ekran: ${bullet.text}`);
  console.log(`  ses: ${scene.voiceover?.text}`);
}
console.log(`\nAçıklama:\n${script.description}`);
