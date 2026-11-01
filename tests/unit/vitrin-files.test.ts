import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import sharp from "sharp";
import { createPublicMediaHandler, type PublicMediaDeps } from "@/lib/dashboard/public-media-handler";
import { createStorageFileHandler } from "@/lib/dashboard/storage-file-handler";
import { likeLiteral, vitrinFileBlocked } from "@/lib/prediction/vitrin-file-rule";

/**
 * Onaysız vitrin görseli DIŞARI verilmez (kurucu kararı 2026-10-20), ama oturum açmış admin her yerde görür
 * (2026-11-01 — onay kuyruğu küçük resimleri kırıktı): `/api/files` yalnızca oturum sorar (oturumlu 200, oturumsuz
 * 403); imzalı, oturumsuz `/api/public-media` DRAFT/REJECTED vitrini 403 ile reddeder.
 */

const vitrin = (status: string) => ({ status, renderOptions: { kind: "VITRIN", imageUrl: "/api/files/renders/a.png" } });
const PNG = sharp({ create: { width: 2, height: 2, channels: 3, background: "#123456" } }).png().toBuffer();

/** Depodaki gerçek bir dosya gibi davranan okuyucu: rota dosyayı okuyabilseydi 200 dönerdi. */
const readFile = async () => PNG;
const fileRequest = (name = "taslak-vitrin.png") => new Request(`https://www.betrix.pro/api/files/renders/${name}`);

describe("onaysız vitrin dosyası", () => {
  it("taslak ve reddedilmiş vitrin dışarı verilmez; onaylı/yayınlanmış verilir", () => {
    assert.equal(vitrinFileBlocked([vitrin("DRAFT")]), true);
    assert.equal(vitrinFileBlocked([vitrin("REJECTED")]), true);
    assert.equal(vitrinFileBlocked([vitrin("APPROVED")]), false);
    assert.equal(vitrinFileBlocked([vitrin("PUBLISHED")]), false);
  });

  it("vitrin dışı kayıt ve sahipsiz dosya etkilenmez", () => {
    assert.equal(vitrinFileBlocked([]), false);
    assert.equal(vitrinFileBlocked([{ status: "DRAFT", renderOptions: { kind: "PLAYER_H2H" } }]), false);
    assert.equal(vitrinFileBlocked([{ status: "DRAFT", renderOptions: null }]), false);
  });

  it("LIKE kalıbı dosya adındaki _ ve % karakterlerini harfiyen arar", () => {
    assert.equal(likeLiteral("/api/files/renders/a_b%c.png"), "/api/files/renders/a\\_b\\%c.png");
  });
});

describe("/api/files — onay kuyruğu, taslak, indirme aynı adres", () => {
  it("oturumlu admin onaysız vitrin görselini alır (200)", async () => {
    const response = await createStorageFileHandler({ hasSession: async () => true, readFile })(fileRequest());
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("Content-Type"), "image/png");
    assert.equal(Buffer.from(await response.arrayBuffer()).equals(await PNG), true);
  });

  it("oturumsuz istek 403 ve dosyaya hiç dokunmaz", async () => {
    let read = false;
    const response = await createStorageFileHandler({
      hasSession: async () => false,
      readFile: async () => {
        read = true;
        return PNG;
      },
    })(fileRequest());
    assert.equal(response.status, 403);
    assert.equal(read, false);
  });

  it("yol gezinmesi ve bilinmeyen kova oturumlu da 404", async () => {
    const handler = createStorageFileHandler({ hasSession: async () => true, readFile });
    assert.equal((await handler(new Request("https://www.betrix.pro/api/storage-file?bucket=renders&file=..%2Fsecret.png"))).status, 404);
    assert.equal((await handler(new Request("https://www.betrix.pro/api/storage-file?bucket=gizli&file=a.png"))).status, 404);
  });
});

describe("/api/public-media — imzalı, oturumsuz yol", () => {
  const deps = (over: Partial<PublicMediaDeps> = {}): PublicMediaDeps => ({
    verify: () => ({ bucket: "renders", fileName: "taslak-vitrin.png" }),
    isUnapprovedVitrin: async () => true,
    readFile,
    ...over,
  });
  const request = new Request("https://www.betrix.pro/api/public-media?f=a&e=1&s=b");

  it("imza geçerli olsa da onaysız vitrin 403", async () => {
    assert.equal((await createPublicMediaHandler(deps())(request)).status, 403);
  });

  it("imza geçersizse 403", async () => {
    assert.equal((await createPublicMediaHandler(deps({ verify: () => null, isUnapprovedVitrin: async () => false }))(request)).status, 403);
  });

  it("onaylı vitrin JPEG olarak verilir (200)", async () => {
    const response = await createPublicMediaHandler(deps({ isUnapprovedVitrin: async () => false }))(request);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("Content-Type"), "image/jpeg");
  });
});

describe("kod bağlantısı", () => {
  const read = (file: string) => readFileSync(path.join(process.cwd(), file), "utf8");
  it("imzalı rota kapıyı bağlar; dosya rotası oturum sorar; inceleme dosya adresini kullanır", () => {
    assert.match(read("src/app/api/public-media/route.ts"), /isUnapprovedVitrin: isUnapprovedVitrinFile/);
    assert.match(read("src/app/api/storage-file/route.ts"), /getCurrentSession\(\)/);
    assert.doesNotMatch(read("src/lib/dashboard/draft-data.ts"), /vitrinReviewSrc/);
  });
});
