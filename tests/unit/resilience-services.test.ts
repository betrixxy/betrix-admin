import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import Anthropic from "@anthropic-ai/sdk";
import type { UploadedImage } from "@/lib/dashboard/studio-images";

/**
 * Dayanıklılık — servis katmanına bağlı parçalar (Anthropic hata yolu, Maç Günü tarafı/kesim ve oyuncu büyütmesi).
 * Bu modüller `lib/env.ts`'i yükler: test, gerçek olmayan yer tutucu değerlerle çalışır (anahtar YOK — hiçbir
 * istek gerçek sağlayıcıya gitmez; istemci, kesimci ve büyütücü enjekte edilir).
 */

process.env.JWT_SECRET ??= "test-yer-tutucu-test-yer-tutucu-test-yer";
process.env.DATABASE_URL ??= "postgresql://test:test@127.0.0.1:1/yok";

type Services = {
  reasons: typeof import("@/lib/services/anthropic/scenario-reasons");
  errors: typeof import("@/lib/services/anthropic/errors");
  sides: typeof import("@/lib/dashboard/match-day-sides");
  upscale: typeof import("@/lib/dashboard/player-upscale");
};
let services: Services;

before(async () => {
  services = {
    reasons: await import("@/lib/services/anthropic/scenario-reasons"),
    errors: await import("@/lib/services/anthropic/errors"),
    sides: await import("@/lib/dashboard/match-day-sides"),
    upscale: await import("@/lib/dashboard/player-upscale"),
  };
});

const image = (width: number, height: number): UploadedImage => ({ bytes: Buffer.from("x"), width, height, hash: `h${width}x${height}`, extension: "jpg", contentType: "image/jpeg", hasAlpha: false });

describe("Anthropic yok / hata: kural tabanlı gerekçe + okunur sebep", () => {
  it("canlı test: HTTP 400 'credit balance is too low' → 'kredisi yetersiz', istisna yok; not metni", async () => {
    let calls = 0;
    const client = {
      messages: {
        parse: async () => {
          calls++;
          throw Anthropic.APIError.generate(400, { type: "error", error: { type: "invalid_request_error", message: "Your credit balance is too low to access the Anthropic API." } }, undefined, new Headers());
        },
      },
    } as unknown as Pick<Anthropic, "messages">;
    const result = await services.reasons.generateScenarioReasons({}, [], { configured: () => true, client: () => client });
    assert.equal(calls, 1);
    assert.ok(!result.ok);
    assert.equal(result.error.message, "Anthropic hesabının kredisi yetersiz (HTTP 400)");
    assert.equal(services.errors.aiReasonsFallbackNote(result.error), "AI gerekçe yazılamadı: Anthropic hesabının kredisi yetersiz (HTTP 400) — kural tabanlı gerekçeler kullanıldı.");
  });

  it("anahtar yok → istemci hiç çağrılmaz", async () => {
    const result = await services.reasons.generateScenarioReasons({}, [], { configured: () => false, client: () => assert.fail("istemci çağrılmamalı") });
    assert.ok(!result.ok);
    assert.equal(result.error.code, "NOT_CONFIGURED");
    assert.match(services.errors.aiReasonsFallbackNote(result.error), /^AI gerekçe yazılamadı: ANTHROPIC_API_KEY tanımlı değil — kural tabanlı/u);
  });

  it("hata eşlemesi: 401, 529, bağlantı, SDK dışı hata", () => {
    const { anthropicFailure } = services.errors;
    assert.match(anthropicFailure(Anthropic.APIError.generate(401, { error: { message: "invalid x-api-key" } }, undefined, new Headers())).message, /geçersiz ya da yetkisiz \(HTTP 401\)/u);
    assert.match(anthropicFailure(Anthropic.APIError.generate(529, { error: { message: "Overloaded" } }, undefined, new Headers())).message, /aşırı yoğun/u);
    assert.equal(anthropicFailure(new Anthropic.APIConnectionError({ message: "ECONNRESET" })).message, "Claude'a bağlanılamadı");
    assert.equal(anthropicFailure(new Error("beklenmeyen")).code, "API_ERROR");
  });
});

describe("Maç Günü: fotoğrafsız / kesilemeyen taraf → yedek tasarım, Fal'a gidilmez", () => {
  it("fotoğraf yok: kesimci HİÇ çağrılmaz, not yazılır", async () => {
    const side = await services.sides.resolveSideCutout(null, "Deplasman oyuncu fotoğrafı", () => assert.fail("Fal'a gidilmemeli"));
    assert.deepEqual([side.bytes, side.paidCalls], [null, 0]);
    assert.match(side.note ?? "", /^Deplasman oyuncu fotoğrafı yok — takımın yedek tasarımı/u);
  });

  it("kesim başarısız (Fal yok/hata): yedek tasarım, sebep notta; başarılı kesim olduğu gibi", async () => {
    const failed = await services.sides.resolveSideCutout(image(1200, 1500), "Ev sahibi oyuncu fotoğrafı", async () => ({ ok: false, error: { code: "NOT_CONFIGURED", message: "Ev sahibi oyuncu fotoğrafı: FAL_KEY tanımlı değil" } }));
    assert.equal(failed.bytes, null);
    assert.equal(failed.note, "Ev sahibi oyuncu fotoğrafı: oyuncu kesimi yapılamadı (FAL_KEY tanımlı değil) — takımın yedek tasarımı çizildi.");
    const ok = await services.sides.resolveSideCutout(image(1200, 1500), "Ev", async () => ({ ok: true, data: { bytes: Buffer.from("png"), paidCalls: 1, fromCache: false } }));
    assert.deepEqual([ok.bytes?.toString(), ok.paidCalls, ok.note], ["png", 1, null]);
  });

  it("oyuncu büyütmesi başarısız → orijinalle devam (kesim düşmez)", async () => {
    const small = image(500, 700);
    const result = await services.upscale.ensurePlayerResolution(small, "Ev sahibi oyuncu fotoğrafı", async () => ({ ok: false, error: { code: "TIMEOUT", message: "Fal zaman aşımı" } }));
    assert.ok(result.ok);
    assert.equal(result.data, small);
  });
});
