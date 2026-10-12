import assert from "node:assert/strict";
import { before, describe, it } from "node:test";

// env.ts içe aktarılırken doğrulanır — test ortamına güvenli yer tutucular (gerçek sır değil).
process.env.JWT_SECRET ??= "test-only-secret-not-used-anywhere-else";
process.env.DATABASE_URL ??= "postgresql://test:test@127.0.0.1:5432/test";
process.env.APP_BASE_URL ??= "https://studio.example.test";

let signPublicMediaUrl: typeof import("@/lib/dashboard/public-media").signPublicMediaUrl;
let verifyPublicMedia: typeof import("@/lib/dashboard/public-media").verifyPublicMedia;
let PUBLIC_MEDIA_TTL_MS: number;

before(async () => {
  ({ signPublicMediaUrl, verifyPublicMedia, PUBLIC_MEDIA_TTL_MS } = await import("@/lib/dashboard/public-media"));
});

const NOW = 1_800_000_000_000;

function parts(url: string) {
  const params = new URL(url).searchParams;
  return [params.get("f"), params.get("e"), params.get("s")] as const;
}

describe("imzalı genel medya bağlantısı", () => {
  it("kart ve AI üretimi imzalanır, süre içinde doğrulanır", () => {
    const url = signPublicMediaUrl("/api/files/renders/abc-123.png", NOW);
    assert.ok(url?.startsWith("https://studio.example.test/api/public-media?"));
    assert.deepEqual(verifyPublicMedia(...parts(url ?? ""), NOW + 60_000), { bucket: "renders", fileName: "abc-123.png" });
    assert.ok(signPublicMediaUrl("/api/files/generated/cutout-v1-x.png", NOW));
  });

  it("yüklemeler ve kütüphane, geçersiz adresler imzalanmaz", () => {
    assert.equal(signPublicMediaUrl("/api/files/uploads/a.png", NOW), null);
    assert.equal(signPublicMediaUrl("/api/files/library/a.png", NOW), null);
    assert.equal(signPublicMediaUrl("/api/files/renders/../.env", NOW), null);
    assert.equal(signPublicMediaUrl("https://evil.example/a.png", NOW), null);
  });

  it("süresi dolan, imzası ya da hedefi değiştirilen, TTL'den uzun bağlantı reddedilir", () => {
    const [target, expires, sig] = parts(signPublicMediaUrl("/api/files/renders/abc.png", NOW) ?? "");
    assert.equal(verifyPublicMedia(target, expires, sig, NOW + PUBLIC_MEDIA_TTL_MS + 1), null);
    assert.equal(verifyPublicMedia("renders/baska.png", expires, sig, NOW), null);
    assert.equal(verifyPublicMedia(target, String(Number(expires) + 1), sig, NOW), null);
    assert.equal(verifyPublicMedia(target, expires, `${sig}x`, NOW), null);
    assert.equal(verifyPublicMedia(target, expires, null, NOW), null);
    // Elle uzatılmış bitiş (TTL'den uzun) imza geçerli olsa bile kabul edilmez.
    const [, farExpires, farSig] = parts(signPublicMediaUrl("/api/files/renders/abc.png", NOW + 10 * PUBLIC_MEDIA_TTL_MS) ?? "");
    assert.equal(verifyPublicMedia(target, farExpires, farSig, NOW), null);
  });
});
