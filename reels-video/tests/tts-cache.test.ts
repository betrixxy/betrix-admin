import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";
import { findCached, LEGACY_FORMATS, OUTPUT_FORMAT, synthesize, ttsCacheKey, TtsError, type TtsRequest } from "../scripts/reel/tts";

const KEY = "gizli-anahtar-degeri";
const dir = mkdtempSync(path.join(tmpdir(), "tts-"));
after(() => rmSync(dir, { recursive: true, force: true }));

const live = { stability: 0.4, similarity_boost: 0.75, style: 0.4, use_speaker_boost: true, speed: 1.05 };
const request = (over: Partial<TtsRequest> = {}): TtsRequest => ({ text: "Maçı birlikte okuyalım.", voiceId: "ses-1", modelId: "model-1", settings: live, ...over });

function fakeApi() {
  const calls: { url: string; apiKey: string | null }[] = [];
  const fetcher = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), apiKey: new Headers(init?.headers).get("xi-api-key") });
    return new Response(JSON.stringify({ audio_base64: Buffer.from("ses").toString("base64"), alignment: { characters: ["a"], character_start_times_seconds: [0], character_end_times_seconds: [1.5] } }), { headers: { "character-cost": "23" } });
  }) as typeof fetch;
  return { calls, fetcher };
}

describe("seslendirme önbelleği (kredi koruma)", () => {
  it("metin, ses ve ayar aynıysa ikinci çağrı istek atmaz, kredi harcamaz", async () => {
    const { calls, fetcher } = fakeApi();
    const first = await synthesize(request(), { apiKey: KEY, cacheDir: dir, fetch: fetcher });
    const second = await synthesize(request(), { apiKey: KEY, cacheDir: dir, fetch: fetcher });
    assert.equal(calls.length, 1);
    assert.equal(first.credits, 23);
    assert.equal(first.cached, false);
    assert.equal(second.credits, 0);
    assert.equal(second.originalCredits, 23);
    assert.equal(second.cached, true);
    assert.equal(second.seconds, 1.5);
    assert.equal(second.audio.toString(), "ses");
  });

  it("metin, ses, model ya da ayar değişirse yeniden üretir", () => {
    const base = ttsCacheKey(request());
    for (const changed of [{ text: "Başka metin." }, { voiceId: "ses-2" }, { modelId: "model-2" }, { settings: { ...live, style: 0.5 } }, { settings: null }]) assert.notEqual(ttsCacheKey(request(changed)), base);
  });

  it("ayar sırası önbelleği bozmaz", () => {
    const { speed, stability, style, similarity_boost, use_speaker_boost } = live;
    assert.equal(ttsCacheKey(request({ settings: { speed, use_speaker_boost, similarity_boost, style, stability } })), ttsCacheKey(request()));
  });

  it("anahtar yalnız başlıkta: adreste, önbellek anahtarında ve hata metninde yok", async () => {
    const { calls, fetcher } = fakeApi();
    await synthesize(request({ text: "Anahtar denemesi." }), { apiKey: KEY, cacheDir: dir, fetch: fetcher });
    assert.equal(calls[0]?.apiKey, KEY);
    assert.ok(!calls[0]?.url.includes(KEY));
    const refused = (async () => new Response(JSON.stringify({ detail: { status: "quota_exceeded" } }), { status: 401 })) as typeof fetch;
    await assert.rejects(synthesize(request({ text: "Hata denemesi." }), { apiKey: KEY, cacheDir: dir, fetch: refused }), (error: unknown) => error instanceof TtsError && error.status === 401 && !error.message.includes(KEY));
  });

  it("zaman damgası reddedilirse düz uca düşer, reddedilen istek önbelleğe yazılmaz", async () => {
    let attempts = 0;
    const fetcher = (async (url: string | URL | Request) => {
      attempts += 1;
      if (String(url).includes("with-timestamps")) return new Response("{}", { status: 422 });
      // 1 sn @ 192 kbps (OUTPUT_FORMAT mp3_44100_192).
      return new Response(new Uint8Array(24000), { headers: { "character-cost": "5" } });
    }) as typeof fetch;
    const result = await synthesize(request({ text: "Düz uç." }), { apiKey: KEY, cacheDir: dir, fetch: fetcher });
    assert.equal(attempts, 2);
    assert.equal(result.alignment, null);
    assert.equal(result.seconds, 1);
  });

  it("biçim 192 kbps'ye geçti ama eski 128 kbps önbellek kullanılır: istek yok, kredi yok", async () => {
    const legacy = request({ text: "Eski biçimde üretilmiş cümle." });
    const key = ttsCacheKey(legacy, LEGACY_FORMATS[0]);
    writeFileSync(path.join(dir, `${key}.mp3`), Buffer.alloc(16000));
    writeFileSync(path.join(dir, `${key}.json`), JSON.stringify({ alignment: null, credits: 30 }));
    const { calls, fetcher } = fakeApi();
    const result = await synthesize(legacy, { apiKey: KEY, cacheDir: dir, fetch: fetcher });
    assert.equal(calls.length, 0);
    assert.equal(result.cached, true);
    assert.equal(result.credits, 0);
    assert.equal(result.seconds, 1);
    assert.equal(findCached(legacy, dir)?.format, "mp3_44100_128");
    assert.notEqual(ttsCacheKey(legacy), key);
    assert.equal(OUTPUT_FORMAT, "mp3_44100_192");
  });
});
