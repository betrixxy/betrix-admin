import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { dedupePages, instagramAccountsOf, isGraphUrl, summarizePages } from "../../src/lib/services/social/meta-pages";

const pages = [
  { id: "1", name: "Checkmatch", instagram_business_account: { id: "ig1", username: "checkmatch" } },
  { id: "2", name: "Yan\nSayfa" },
  { id: "3", instagram_business_account: { id: "ig3" } },
];

describe("Meta Sayfa yardımcıları", () => {
  it("Sayfalar tek satırda id:ad:ig=var/yok biçiminde özetlenir", () => {
    assert.equal(summarizePages(pages), "1:Checkmatch:ig=var, 2:Yan Sayfa:ig=yok, 3:-:ig=var");
    assert.equal(summarizePages([]), "-");
  });
  it("Sayfaya bağlı tüm IG hesapları sırasıyla döner", () => {
    assert.deepEqual(instagramAccountsOf(pages), [
      { id: "ig1", username: "checkmatch" },
      { id: "ig3", username: null },
    ]);
  });
  it("aynı Sayfa iki yoldan gelirse ilki tutulur", () => {
    const merged = dedupePages([...pages, { id: "1", name: "Kopya" }]);
    assert.equal(merged.length, 3);
    assert.equal(merged[0]?.name, "Checkmatch");
  });
  it("paging.next yalnızca Graph API adresiyse takip edilir", () => {
    assert.equal(isGraphUrl("https://graph.facebook.com/v21.0/me/accounts?after=x"), true);
    assert.equal(isGraphUrl("https://evil.example/graph.facebook.com/"), false);
  });
});
