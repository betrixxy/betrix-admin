import "./reel/setup-env";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { elevenGet, synthesize, TtsError, type TtsRequest, type VoiceSettings } from "./reel/tts";

/**
 * Ses seçimi örnekleri. `npm run voices -- --plan`: yalnız liste ve kredi tahmini, üretim yok. `npm run voices`: üretir; önbellek sayesinde
 * yeniden çalıştırmak kredi harcamaz. Üst sınır `--max-credits` (varsayılan 15.000). Çıktı `test-photos/reels-voice/`.
 */

const OUT = path.resolve(process.cwd(), "../../test-photos/reels-voice");
const CACHE = path.join(OUT, "_onbellek");
const SAMPLE = "Galatasaray bu akşam sahaya çıkmadan… biz maçı tam beş yüz bin kez oynattık. Sonuç mu? Galatasaray yüzde elli iki. Ama asıl hikâye burada değil. Stuttgart son sekiz deplasmanının yedisinde gol buldu… Peki bu akşam ilk golü kim atacak? Sonuna kadar izle, cevap videonun sonunda.";
const TAGGED = "[excited] Galatasaray bu akşam sahaya çıkmadan… [short pause] biz maçı tam beş yüz bin kez oynattık. [curious] Sonuç mu? [excited] Galatasaray yüzde elli iki. [whispers] Ama asıl hikâye burada değil. [short pause] Stuttgart son sekiz deplasmanının yedisinde gol buldu… [curious] Peki bu akşam ilk golü kim atacak? [excited] Sonuna kadar izle, cevap videonun sonunda.";
const PRONUNCIATION = "Stuttgart, Osimhen, Icardi, Barış Alper Yılmaz, xG, yüzde altmış sekiz, beş yüz bin.";
const LIVE: VoiceSettings = { stability: 0.4, similarity_boost: 0.75, style: 0.4, use_speaker_boost: true, speed: 1.05 };
/** v3 ailesi kararlılıkta yalnız bu değerleri kabul edebiliyor: reddedilirse en yakını denenir. */
const DISCRETE_STABILITY = 0.5;
const STABLE_MODEL = "eleven_multilingual_v2";

interface Voice { voice_id: string; name: string; category?: string; labels?: Record<string, string>; verified_languages?: { language?: string; accent?: string | null }[] }
interface Model { model_id: string; name?: string; can_do_text_to_speech?: boolean; languages?: { language_id: string; name: string }[] }
interface Row { voice: string; model: string; version: string; file: string; seconds: number | null; credits: number; note: string }

const apiKey = process.env.ELEVENLABS_API_KEY;
if (!apiKey) {
  console.error("ELEVENLABS_API_KEY yok: reels-video/.env.local dosyasına ekleyin.");
  process.exit(1);
}
const deps = { apiKey, cacheDir: CACHE };
const argument = (name: string) => {
  const at = process.argv.indexOf(name);
  return at >= 0 ? process.argv[at + 1] ?? null : null;
};
const planOnly = process.argv.includes("--plan");
const maxCredits = Number(argument("--max-credits") ?? 15000);
const slug = (name: string) => name.toLocaleLowerCase("tr-TR").replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/gu, "");
const supportsTurkish = (model: Model) => model.languages?.some((language) => language.language_id === "tr") ?? false;
const isExpressive = (id: string) => /v4|v3/u.test(id);

async function credits(): Promise<{ used: number; limit: number } | null> {
  try {
    const plan = await elevenGet<{ character_count: number; character_limit: number }>("/v1/user/subscription", deps);
    return { used: plan.character_count, limit: plan.character_limit };
  } catch {
    return null;
  }
}

try {
  const models = await elevenGet<Model[]>("/v1/models", deps);
  const speaking = models.filter((model) => model.can_do_text_to_speech);
  console.log(`TTS modelleri: ${speaking.map((model) => `${model.model_id}${supportsTurkish(model) ? " [tr]" : " [tr yok]"}`).join(", ")}`);
  const newest = speaking.find((model) => /v4/u.test(model.model_id)) ?? speaking.find((model) => /v3/u.test(model.model_id));
  const stable = speaking.find((model) => model.model_id === STABLE_MODEL);
  const chosen = [newest, stable].filter((model): model is Model => Boolean(model));
  if (!newest) console.log("v4/v3 modeli bu hesapta görünmüyor: yalnız v2 üretilir.");
  else if (!supportsTurkish(newest)) console.log(`UYARI: ${newest.model_id} dil listesinde Türkçe yok; yine de denenir, kulakla kontrol edilmeli.`);

  const voiceList = await elevenGet<{ voices: Voice[] }>("/v2/voices?page_size=100&voice_type=non-default", deps);
  const voices = voiceList.voices;
  console.log(`My Voices: ${voices.length}`);
  for (const voice of voices) console.log(`  ${voice.name} | ${voice.voice_id} | ${voice.category ?? "?"} | dil: ${voice.labels?.language ?? (voice.verified_languages ?? []).map((item) => item.language).join(",") ?? "?"} | aksan: ${voice.labels?.accent ?? "?"}`);

  const estimate = voices.length * chosen.reduce((sum, model) => sum + 2 * SAMPLE.length + PRONUNCIATION.length + (isExpressive(model.model_id) ? TAGGED.length : 0), 0);
  const before = await credits();
  console.log(`tahmini kredi: ${estimate} | sınır: ${maxCredits} | hesap: ${before ? `${before.used}/${before.limit}` : "okunamadı"}`);
  if (planOnly) process.exit(0);
  if (voices.length === 0) throw new Error("My Voices boş: üretim yapılmadı.");
  if (estimate > maxCredits) throw new Error(`Tahmin sınırı aşıyor (${estimate} > ${maxCredits}): üretim yapılmadı.`);

  mkdirSync(OUT, { recursive: true });
  const rows: Row[] = [];
  let spent = 0;
  const produce = async (voice: Voice, model: Model, version: string, text: string, settings: VoiceSettings | null) => {
    // Tahmin karakter başına 1 kredi varsayar; modelin gerçek oranı farklıysa harcama burada kesilir.
    if (spent >= maxCredits) throw new Error(`Harcama sınırına ulaşıldı (${spent} / ${maxCredits}): üretim durdu.`);
    const base = `${slug(voice.name)}_${model.model_id}_${version}`;
    const request: TtsRequest = { text, voiceId: voice.voice_id, modelId: model.model_id, settings };
    let note = "";
    try {
      let result;
      try {
        result = await synthesize(request, deps);
      } catch (cause) {
        if (!(cause instanceof TtsError) || !settings || !isExpressive(model.model_id) || (cause.status !== 400 && cause.status !== 422)) throw cause;
        result = await synthesize({ ...request, settings: { ...settings, stability: DISCRETE_STABILITY } }, deps);
        note = `kararlılık ${settings.stability} reddedildi, ${DISCRETE_STABILITY} kullanıldı`;
      }
      writeFileSync(path.join(OUT, `${base}.mp3`), result.audio);
      spent += result.credits;
      rows.push({ voice: voice.name, model: model.model_id, version, file: `${base}.mp3`, seconds: result.seconds, credits: result.originalCredits, note: `${note}${result.alignment ? "" : `${note ? "; " : ""}zaman damgası yok`}` });
      console.log(`${base}: ${result.seconds.toFixed(1)} sn, ${result.credits} kredi${result.cached ? " (önbellek)" : ""}`);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "bilinmeyen hata";
      rows.push({ voice: voice.name, model: model.model_id, version, file: "-", seconds: null, credits: 0, note: message });
      console.log(`${base}: BAŞARISIZ ${message}`);
      if (cause instanceof TtsError && (cause.status === 401 || cause.status === 402 || cause.status === 429)) throw cause;
    }
  };

  for (const voice of voices) {
    for (const model of chosen) {
      await produce(voice, model, "varsayılan", SAMPLE, null);
      await produce(voice, model, "canli", SAMPLE, LIVE);
      if (isExpressive(model.model_id)) await produce(voice, model, "canli-etiketli", TAGGED, LIVE);
      await produce(voice, model, "telaffuz", PRONUNCIATION, null);
    }
  }

  const after = await credits();
  const accountSpent = before && after ? after.used - before.used : null;
  const table = rows.map((row) => `| ${row.voice} | ${row.model} | ${row.version} | ${row.seconds === null ? "-" : row.seconds.toFixed(1)} | ${row.credits} | ${row.file} | ${row.note} |  |`);
  writeFileSync(path.join(OUT, "KARSILASTIRMA.md"), [
    "# Ses karşılaştırması", "",
    `Bu çalıştırmada harcanan: **${spent} kredi** (istek başlıklarından)${accountSpent === null ? "" : `; hesap sayacı farkı **${accountSpent}**`}.`,
    `Hesap: ${after ? `${after.used} / ${after.limit}` : "okunamadı"}.`, "",
    "`varsayılan`: sesin kayıtlı ayarları. `canli`: kararlılık 0,4, stil 0,4, benzerlik 0,75, hız 1,05. `canli-etiketli`: aynı ayar, ses etiketli metin.",
    "Telaffuz notu sütunu kulakla doldurulacak: bu araç sesi dinleyemez.", "",
    "| Ses | Model | Sürüm | Süre (sn) | Kredi | Dosya | Teknik not | Telaffuz notu |", "|---|---|---|---|---|---|---|---|", ...table, "",
  ].join("\n"));
  console.log(`bitti: ${rows.length} satır, ${spent} kredi${accountSpent === null ? "" : `, hesap farkı ${accountSpent}`} → ${OUT}`);
} catch (cause) {
  console.error(cause instanceof Error ? cause.message : "Bilinmeyen hata");
  process.exitCode = 1;
}
process.exit(process.exitCode ?? 0);
