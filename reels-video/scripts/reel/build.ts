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
import { estimateSeconds, pronounce, spokenTexts, VOICE_PROFILES, type VoiceProfile } from "./voice";

/** Dondurulmuş veriden senaryo ve metin dosyaları. Saf: ağa çıkmaz, yazmaz. Şablon cümleler, LLM yok. */

export interface BuiltReel {
  data: MatchData;
  script: ReelScript;
  angle: StoryAngle;
  seconds: number;
  problems: string[];
  photoNeeds: string[];
  profile: VoiceProfile;
  /** ElevenLabs'e giden sahne metinleri (etiket + okunuş); ekran metni `script` içinde, ayrı. */
  spoken: (string | null)[];
  /** Tahmini sesi kart süresine sığmayan sahneler: gerçek ses gelince süre sesten kurulur, 6 sn'yi geçerse render durur. */
  longVoice: string[];
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
/** Okunuşa göre (xG → "gol beklentisi") sözcük sayısı: ses bu metni okur. */
const framesFor = (text: string, wordsPerSecond: number) => Math.ceil((wordCount(pronounce(text)) / wordsPerSecond) * FPS);

/**
 * Ses henüz yokken süre tahmini: kart sesi taşıyacak kadar uzar (en çok 6 sn). Yine sığmıyorsa sondaki cümle düşer; rakam ya da
 * ekran maddesi değişmez. Hız seçilen sesin ölçülen hızıdır; gerçek ses gelince süreler ölçülen sesten yeniden kurulur.
 * Etkileşim kartı kendi kuralında.
 */
export function fitVoice(scene: ReelScene, wordsPerSecond: number = WORDS_PER_SECOND): ReelScene {
  if (!scene.voiceover || scene.type === "S18_ENGAGE") return scene;
  let lines = scene.voiceover.lines;
  const textOf = (items: typeof lines) => items.map((line) => line.text).join(" ");
  while (lines.length > 1 && framesFor(textOf(lines), wordsPerSecond) > MAX_CARD_FRAMES) lines = lines.slice(0, -1);
  const text = textOf(lines);
  return { ...scene, voiceover: { text, lines }, durationInFrames: Math.max(scene.durationInFrames, Math.min(MAX_CARD_FRAMES, framesFor(text, wordsPerSecond))) } as ReelScene;
}

/**
 * Onaylı kısaltma: seslendirmeden çıkarılan satırlar (satır kimliğiyle, ör. `vo.c09.first`). Yalnız metin kısalır; ekran, rakam ve
 * ses hızı değişmez. Sahnenin bütün satırları çıkarılamaz.
 */
export function dropVoiceLines(scene: ReelScene, drop: ReadonlySet<string>): ReelScene {
  if (!scene.voiceover || !scene.voiceover.lines.some((line) => drop.has(line.id))) return scene;
  const lines = scene.voiceover.lines.filter((line) => !drop.has(line.id));
  if (!lines.length) throw new Error(`${scene.type}: bütün seslendirme satırları çıkarılamaz`);
  return { ...scene, voiceover: { text: lines.map((line) => line.text).join(" "), lines } } as ReelScene;
}

export function buildReel(frozen: Frozen, profile: VoiceProfile = VOICE_PROFILES.standart, dropLines: readonly string[] = []): BuiltReel {
  const data = matchDataFromContract(frozen.detail, frozen.extras);
  const now = new Date(frozen.fetched_at);
  const entries = evaluatePool(data, BRAND, { now });
  const angle = angleOf(data);
  const drop = new Set(dropLines);
  // Kart süresi okunurluk kuralının hızıyla (3 sözcük/sn) kurulur; sesin ölçülen hızına göre sığmayanlar `longVoice`te raporlanır.
  const scenes = pickStory(entries, angle).map((scene) => fitVoice(dropVoiceLines(scene, drop)));
  const disabled = entries.flatMap((entry) => (entry.reason ? [{ type: entry.type, reason: entry.reason }] : []));
  const script = reelScriptSchema.parse(buildScript(data, scenes, disabled));
  const seconds = buildTimeline(scenes.map((scene) => scene.durationInFrames)).total / 30;
  const language = contentLanguageGate({ card: scenes.flatMap((scene) => sceneTexts([scene.headline, scene.data, scene.voiceover?.text ?? ""])) });
  const spoken = spokenTexts(script.scenes, profile);
  const longVoice = script.scenes.flatMap((scene, index) => {
    const text = spoken[index];
    const limit = scene.durationInFrames / FPS;
    return text && estimateSeconds(text, profile) > limit + 0.5 ? [`${index + 1}. ${scene.type}: ses tahmini ${estimateSeconds(text, profile).toFixed(1)} sn, kart ${limit.toFixed(1)} sn`] : [];
  });
  const problems = [
    ...storyProblems(scenes, data, seconds),
    ...readabilityProblems(script),
    ...(frozen.detail.quality.stale ? ["Veri bayat (data_stale)"] : []),
    ...(language ? [language] : []),
    // Etiket ekran metnine asla girmez.
    ...(script.scenes.some((scene) => sceneTexts([scene.headline, scene.data, scene.caption ?? ""]).some((text) => /\[[a-z ]+\]/u.test(text))) ? ["Ekran metninde ses etiketi"] : []),
  ];
  return { data, script, angle, seconds, problems: [...new Set(problems)], photoNeeds: photoNeedsOf(scenes), profile, spoken, longVoice };
}

/** Ekranda yazı olarak görünmeyen iç değerler (tahta seviyesi). */
const INTERNAL_VALUES = new Set(["strong", "weak"]);

/** `measured`: gerçek ses süreleri (sn, sahne sırasıyla). Verilirse tahmin yerine yazılır ve kart süreleri sesten kurulmuş sayılır. */
export function scenarioText(reel: BuiltReel, frozen: Frozen, header: string[] = [], measured: readonly (number | null)[] | null = null): string {
  const { home, away } = reel.script.meta.teams;
  const istanbul = new Date(frozen.detail.match.kickoff_utc).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul", dateStyle: "full", timeStyle: "short" });
  const audioOf = (index: number) => (measured ? measured[index] ?? 0 : reel.spoken[index] ? estimateSeconds(reel.spoken[index] ?? "", reel.profile) : 0);
  const voiced = reel.spoken.reduce((sum, _text, index) => sum + audioOf(index), 0);
  const seconds = buildTimeline(reel.script.scenes.map((scene) => scene.durationInFrames)).total / FPS;
  const lines = [
    `${home.name} – ${away.name}`,
    `${reel.script.meta.league.name} | ${istanbul} TSİ (${frozen.detail.match.kickoff_utc}) | açı: ${reel.angle === "derby" ? "başa baş" : "favori"}`,
    `Dondurma: ${frozen.fetched_at} | Kadro: ${frozen.squad_checked_at ?? "doğrulanamadı"} | Hesap: ${frozen.detail.model.computed_at} | data_stale: ${frozen.detail.quality.stale}`,
    `Ses: ${reel.profile.label} · ${reel.profile.voiceName} · ${reel.profile.modelId} · canlı ayar${reel.profile.tags ? " · ses etiketleri AÇIK" : " · etiket yok"}`,
    ...header,
    measured
      ? `Süre: video ${seconds.toFixed(1)} sn (kartlar ölçülen sesten) | sesin ölçülen toplamı ${voiced.toFixed(1)} sn | Sahne: ${reel.script.scenes.length}`
      : `Süre: kartlar ${reel.seconds.toFixed(1)} sn | sesin tahmini toplamı ${voiced.toFixed(1)} sn (gerçek süre sesten ölçülür) | Sahne: ${reel.script.scenes.length}`,
    `Engel: ${reel.problems.length ? reel.problems.join(" | ") : "yok"}`,
    ...(!measured && reel.longVoice.length ? [`Ses kartı aşabilir: ${reel.longVoice.join(" | ")}`] : []),
    "",
  ];
  reel.script.scenes.forEach((scene, index) => {
    const spoken = reel.spoken[index];
    lines.push(`--- ${index + 1}. ${scene.type} | kart ${(scene.durationInFrames / 30).toFixed(1)} sn | ses ${measured ? "" : "tahmini "}${audioOf(index).toFixed(1)} sn`);
    if (scene.headline) lines.push(`BAŞLIK: ${scene.headline.line1} ${scene.headline.line2}`);
    const screen = sceneTexts(scene.data).filter((text) => !INTERNAL_VALUES.has(text));
    lines.push(`EKRAN: ${screen.length ? screen.join(" · ") : "(yalnız başlık ve grafik)"}`);
    lines.push(`SES: ${spoken ?? "(yok)"}`, "");
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
