import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { likeLiteral, vitrinFileBlocked } from "@/lib/prediction/vitrin-file-rule";

/**
 * Onaysız vitrin görseli dosya adresinden verilmez (kurucu kararı 2026-10-20, tamamlandı 2026-10-30):
 * `/api/files` ve imzalı `/api/public-media` DRAFT/REJECTED vitrinin görselini 403 ile reddeder; inceleme
 * ekranı gömülü önizleme kullanır (`vitrinReviewSrc`).
 */

const vitrin = (status: string) => ({ status, renderOptions: { kind: "VITRIN", imageUrl: "/api/files/renders/a.png" } });

describe("onaysız vitrin dosyası", () => {
  it("taslak ve reddedilmiş vitrin reddedilir; onaylı/yayınlanmış verilir", () => {
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

  it("iki dosya rotası da dosyayı okumadan ÖNCE denetler; inceleme gömülü önizleme kullanır", () => {
    for (const route of ["src/app/api/storage-file/route.ts", "src/app/api/public-media/route.ts"]) {
      const source = readFileSync(path.join(process.cwd(), route), "utf8");
      const gate = source.indexOf("isUnapprovedVitrinFile(");
      assert.ok(gate > 0 && gate < source.indexOf("readStoredFile("), `${route}: denetim okumadan önce olmalı`);
    }
    assert.ok(readFileSync(path.join(process.cwd(), "src/lib/dashboard/draft-data.ts"), "utf8").includes("vitrinReviewSrc("));
  });
});
