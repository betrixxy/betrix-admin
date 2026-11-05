import "./setup-env";
import { CONTENT_TAGS, hashtagLine } from "@/lib/dashboard/caption-hashtags";
import { contentLanguageGate } from "@/lib/prediction/content-language";
import { buildTimeline } from "../../src/lib/motion";
import { MAX_CARD_FRAMES, readabilityProblems } from "../../src/story/readability";
import { WORDS_PER_SECOND, wordCount } from "../../src/story/speech";
import { matchDataFromContract } from "../../src/story/from-contract";
import type { MatchData } from "../../src/story/match-data";
import { sceneTexts } from "../../src/story/name-guard";
import { BRAND, buildScript, evaluatePool, pickStory, storyProblems, type StoryAngle } from "../../src/story/pool";
import { reelScriptSchema, type ReelScene, type ReelScript } from "../../src/schema";
import type { Frozen } from "./freeze";

/** Dondurulmuş veriden senaryo ve metin dosyaları. Saf: ağa çıkmaz, yazmaz. Şablon cümleler, LLM yok. */

export interface BuiltReel {
  data: MatchData;
  script: ReelScript;
  angle: StoryAngle;
  seconds: number;
  problems: string[];
  photoNeeds: string[];
}

/** Olasılıklar başa baş ise "derbi" açısı; net favori varsa "favori". */
const FAVOURITE_GAP = 0.2;
export const angleOf = (data: MatchData): StoryAngle => (Math.abs(data.outcome.home_win - data.outcome.away_win) >= FAVOURITE_GAP ? "favourite" : "derby");

const ascii = (text: string) => text.toLocaleLowerCase("tr-TR").replace(/ı/gu, "i").normalize("NFD").replace(/[̀-ͯ]/gu, "").replace(/[^a-z0-9]+/gu, "-").replace(/^-|-$/gu, "");
export const slugOf = (frozen: Frozen, matchId: number) => `${ascii(frozen.extras.teams.home.short_name)}-${ascii(frozen.extras.teams.away.short_name)}-${matchId}`;

function photoNeedsOf(scenes: readonly ReelScene[]): string[] {
  const names = scenes.flatMap((scene) => {
    if (scene.type === "P01_DUEL") return [`${scene.data.home.name} (${scene.data.home.team})`, `${scene.data.away.name} (${scene.data.away.team})`];
    return [];
  });
  return [...new Set(names)];
}

const FPS = 30;
const framesFor = (text: string) => Math.ceil(wordCount(text) / WORDS_PER_SECOND) * FPS;

/**
 * Ses henüz yokken süre tahmini: kart sesi taşıyacak kadar uzar (en çok 6 sn). Yine sığmıyorsa sondaki cümle düşer; rakam ya da
 * ekran maddesi değişmez. Gerçek ses gelince süreler ölçülen sesten yeniden kurulur. Etkileşim kartı ve notlu kartlar kendi kuralında.
 */
export function fitVoice(scene: ReelScene): ReelScene {
  if (!scene.voiceover || scene.type === "S18_ENGAGE") return scene;
  let lines = scene.voiceover.lines;
  const textOf = (items: typeof lines) => items.map((line) => line.text).join(" ");
  while (lines.length > 1 && framesFor(textOf(lines)) > MAX_CARD_FRAMES) lines = lines.slice(0, -1);
  const text = textOf(lines);
  return { ...scene, voiceover: { text, lines }, durationInFrames: Math.max(scene.durationInFrames, Math.min(MAX_CARD_FRAMES, framesFor(text))) } as ReelScene;
}

export function buildReel(frozen: Frozen): BuiltReel {
  const data = matchDataFromContract(frozen.detail, frozen.extras);
  const now = new Date(frozen.fetched_at);
  const entries = evaluatePool(data, BRAND, { now });
  const angle = angleOf(data);
  const scenes = pickStory(entries, angle).map(fitVoice);
  const disabled = entries.flatMap((entry) => (entry.reason ? [{ type: entry.type, reason: entry.reason }] : []));
  const script = reelScriptSchema.parse(buildScript(data, scenes, disabled));
  const seconds = buildTimeline(scenes.map((scene) => scene.durationInFrames)).total / 30;
  const language = contentLanguageGate({ card: scenes.flatMap((scene) => sceneTexts([scene.headline, scene.data, scene.voiceover?.text ?? ""])) });
  const problems = [
    ...storyProblems(scenes, data, seconds),
    ...readabilityProblems(script),
    ...(frozen.detail.quality.stale ? ["Veri bayat (data_stale)"] : []),
    ...(language ? [language] : []),
  ];
  return { data, script, angle, seconds, problems: [...new Set(problems)], photoNeeds: photoNeedsOf(scenes) };
}

export function scenarioText(reel: BuiltReel, frozen: Frozen): string {
  const { home, away } = reel.script.meta.teams;
  const lines = [
    `${home.name} – ${away.name}`,
    `${reel.script.meta.league.name} | ${frozen.detail.match.kickoff_utc} | açı: ${reel.angle === "derby" ? "başa baş" : "favori"}`,
    `Dondurma: ${frozen.fetched_at} | Kadro: ${frozen.squad_checked_at ?? "doğrulanamadı"} | Hesap: ${frozen.detail.model.computed_at}`,
    `Süre: ${reel.seconds.toFixed(1)} sn (ses gelince sese göre değişir) | Sahne: ${reel.script.scenes.length}`,
    `Engel: ${reel.problems.length ? reel.problems.join(" | ") : "yok"}`,
    "",
  ];
  reel.script.scenes.forEach((scene, index) => {
    lines.push(`--- ${index + 1}. ${scene.type} (${(scene.durationInFrames / 30).toFixed(1)} sn)`);
    if (scene.headline) lines.push(`BAŞLIK: ${scene.headline.line1} ${scene.headline.line2}`);
    lines.push(`EKRAN: ${sceneTexts(scene.data).join(" · ")}`);
    lines.push(`SES: ${scene.voiceover?.text ?? "(yok)"}`, "");
  });
  const failed = frozen.detail.quality.checks.filter((check) => !check.ok);
  if (failed.length) lines.push("--- KALİTE NOTLARI (zorunlu değil, yayın kararı için)", ...failed.map((check) => `${check.name}: ${check.detail}`), "");
  lines.push("--- KAPALI SAHNELER");
  for (const item of reel.script.disabled) lines.push(`${item.type}: ${item.reason}`);
  if (frozen.warnings.length) lines.push("", "--- VERİ UYARILARI", ...frozen.warnings);
  return `${lines.join("\n")}\n`;
}

/** Instagram ≤ 5 hashtag, TikTok, YouTube Shorts. Bahis dili ve link yok: kapıdan geçemeyen metin yazılmaz. */
export function captionFiles(reel: BuiltReel, frozen: Frozen): string {
  const { home, away } = frozen.extras.teams;
  const tags = hashtagLine({ names: [home.short_name, away.short_name], competitions: [frozen.extras.league_name], type: CONTENT_TAGS.AI_MARKET_PREDICTION });
  const body = reel.script.description.split("\n").filter((line) => !line.startsWith("@")).join("\n");
  const question = "Sence maç nasıl biter? Yorumlara yaz.";
  const instagram = `${body}\n\n${question}\n\n${tags}`;
  const tiktok = `${home.short_name} – ${away.short_name}: maç önü analiz. ${question}\n\n${tags}`;
  const title = `${home.short_name} – ${away.short_name}: Maç Önü Analiz`;
  const youtube = `${body}\n\n${question}\n\n${tags}`;
  const problem = contentLanguageGate({ caption: instagram }) ?? contentLanguageGate({ caption: tiktok }) ?? contentLanguageGate({ caption: `${title}\n${youtube}` });
  if (problem) throw new Error(`Açıklama metni kapıdan geçmedi: ${problem}
${instagram}`);
  return [`=== INSTAGRAM ===\n${instagram}`, `=== TIKTOK ===\n${tiktok}`, `=== YOUTUBE SHORTS ===\nBAŞLIK: ${title}\nAÇIKLAMA:\n${youtube}`].join("\n\n") + "\n";
}
