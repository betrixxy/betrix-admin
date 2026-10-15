import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canReuseLinkedPost, publishedMediaType } from "@/lib/dashboard/post-source";
import { igMediaType, mapInstagramMedia, mapXTweetList, planImport, xPermalink } from "@/lib/services/social/import-mappers";
import { igMediaListSchema } from "@/lib/services/social/instagram-raw";
import { estimateImport, utcDay, xReadAllowance } from "@/lib/services/social/x-budget";
import { xTweetListSchema } from "@/lib/services/social/x-raw";
import type { ImportedPost } from "@/types/social";

describe("içe aktarma — Instagram ham yanıt → gönderi", () => {
  const raw = igMediaListSchema.parse({
    data: [
      {
        id: "1790",
        caption: "Derbi! #SüperLig",
        media_type: "CAROUSEL_ALBUM",
        media_product_type: "FEED",
        permalink: "https://www.instagram.com/p/abc/",
        timestamp: "2026-10-01T18:30:00+0000",
        like_count: 12,
        comments_count: "3",
        children: { data: [{ id: "a", media_type: "IMAGE", media_url: "https://cdn/1.jpg" }, { id: "b", media_type: "IMAGE", media_url: "https://cdn/2.jpg" }] },
      },
      { id: "1791", media_type: "VIDEO", media_product_type: "REELS", media_url: "https://cdn/v.mp4", thumbnail_url: "https://cdn/t.jpg", timestamp: "2026-10-02T10:00:00+0000" },
    ],
  });

  it("carousel: tüm alt görseller sırasıyla, ilk görsel küçük resim", () => {
    const post = mapInstagramMedia(raw.data[0]!);
    assert.ok(post);
    assert.equal(post.mediaType, "CAROUSEL");
    assert.deepEqual(post.mediaUrls, ["https://cdn/1.jpg", "https://cdn/2.jpg"]);
    assert.equal(post.thumbnailUrl, "https://cdn/1.jpg");
    assert.equal(post.publishedAt.toISOString(), "2026-10-01T18:30:00.000Z");
    assert.equal(post.caption, "Derbi! #SüperLig");
  });

  it("reels: küçük resim video dosyası değil thumbnail_url, açıklama yoksa boş", () => {
    const post = mapInstagramMedia(raw.data[1]!);
    assert.equal(post?.mediaType, "REELS");
    assert.equal(post?.thumbnailUrl, "https://cdn/t.jpg");
    assert.equal(post?.caption, "");
  });

  it("medya türü: ürün türü (STORY/REELS) medya türünden önce gelir", () => {
    assert.equal(igMediaType({ media_type: "IMAGE", media_product_type: "STORY" }), "STORY");
    assert.equal(igMediaType({ media_type: "VIDEO" }), "VIDEO");
    assert.equal(igMediaType({ media_type: "IMAGE", media_product_type: "FEED" }), "IMAGE");
  });

  it("geçersiz zaman damgalı öğe atlanır", () => {
    assert.equal(mapInstagramMedia({ id: "x", media_type: "IMAGE", timestamp: "dün" }), null);
  });
});

describe("içe aktarma — X ham yanıt → gönderi", () => {
  const raw = xTweetListSchema.parse({
    data: [
      { id: "111", text: "Görselli", created_at: "2026-10-03T12:00:00.000Z", attachments: { media_keys: ["3_1"] } },
      { id: "112", text: "Sadece metin", created_at: "2026-10-03T13:00:00.000Z" },
      { id: "113", text: "İki görsel", created_at: "2026-10-03T14:00:00.000Z", attachments: { media_keys: ["3_2", "3_3"] } },
    ],
    includes: { media: [{ media_key: "3_1", type: "photo", url: "https://pbs/1.jpg" }, { media_key: "3_2", type: "photo", url: "https://pbs/2.jpg" }, { media_key: "3_3", type: "photo", url: "https://pbs/3.jpg" }] },
    meta: { result_count: 3 },
  });

  it("medya anahtarları includes ile eşlenir; metin/tek/çoklu ayrımı", () => {
    const posts = mapXTweetList(raw, "checkmatch");
    assert.deepEqual(posts.map((post) => post.mediaType), ["IMAGE", "TEXT", "CAROUSEL"]);
    assert.deepEqual(posts[2]?.mediaUrls, ["https://pbs/2.jpg", "https://pbs/3.jpg"]);
    assert.equal(posts[0]?.permalink, "https://x.com/checkmatch/status/111");
  });

  it("sonuç yoksa (data alanı gelmez) boş liste; kullanıcı adı yoksa genel bağlantı", () => {
    assert.deepEqual(mapXTweetList(xTweetListSchema.parse({ meta: { result_count: 0 } }), null), []);
    assert.equal(xPermalink(null, "9"), "https://x.com/i/web/status/9");
  });
});

describe("içe aktarma — idempotentlik", () => {
  const post = (id: string): ImportedPost => ({
    platform: "X",
    providerPostId: id,
    caption: "",
    publishedAt: new Date("2026-10-01T00:00:00Z"),
    permalink: null,
    mediaType: "TEXT",
    thumbnailUrl: null,
    mediaUrls: [],
  });

  it("kayıtlı kimlik tekrar eklenmez, aynı yanıttaki çift de bir kez sayılır", () => {
    const plan = planImport(new Set(["1"]), [post("1"), post("2"), post("2"), post("3")]);
    assert.deepEqual(plan.toCreate.map((item) => item.providerPostId), ["2", "3"]);
    assert.equal(plan.skipped, 2);
  });

  it("ikinci içe aktarma hiçbir şey eklemez", () => {
    const first = planImport(new Set(), [post("1"), post("2")]);
    const second = planImport(new Set(first.toCreate.map((item) => item.providerPostId)), [post("1"), post("2")]);
    assert.equal(second.toCreate.length, 0);
    assert.equal(second.skipped, 2);
  });
});

describe("gönderi kaydı — Yayın Merkezi paylaşımı", () => {
  it("medya türü: hikâye, tekli, çoklu, metin", () => {
    assert.equal(publishedMediaType("IG_REELS_STORY", "multi", 3), "STORY");
    assert.equal(publishedMediaType("IG_POST", "multi", 3), "CAROUSEL");
    assert.equal(publishedMediaType("IG_POST", "single", 1), "IMAGE");
    assert.equal(publishedMediaType("X", "multi", 0), "TEXT");
  });

  it("takvim gönderisi yalnızca aynı platformda ve henüz paylaşılmamışsa yeniden kullanılır", () => {
    assert.equal(canReuseLinkedPost({ platformType: "X", providerPostId: null }, "X"), true);
    assert.equal(canReuseLinkedPost({ platformType: "META_INSTAGRAM", providerPostId: null }, "X"), false);
    assert.equal(canReuseLinkedPost({ platformType: "X", providerPostId: "123" }, "X"), false);
    assert.equal(canReuseLinkedPost(null, "X"), false);
  });
});

describe("X kredi koruması", () => {
  it("günlük sınır: kalan kadar izin, negatif yok", () => {
    assert.equal(xReadAllowance(0, 300, 100), 100);
    assert.equal(xReadAllowance(250, 300, 100), 50);
    assert.equal(xReadAllowance(300, 300, 100), 0);
    assert.equal(xReadAllowance(400, 300, 100), 0);
  });

  it("gün UTC'dir (İstanbul gece yarısı X'te hâlâ önceki gün)", () => {
    assert.equal(utcDay(new Date("2026-10-15T23:30:00+03:00")), "2026-10-15");
    assert.equal(utcDay(new Date("2026-10-16T02:30:00+03:00")), "2026-10-15");
  });

  it("içe aktarma tahmini: X 100'lük sayfa, owned $0.001 / standart $0.005; Instagram ücretsiz", () => {
    assert.deepEqual(estimateImport("X", 100), { requests: 1, reads: 100, ownedUsd: 0.1, standardUsd: 0.5 });
    assert.deepEqual(estimateImport("X", 250), { requests: 3, reads: 250, ownedUsd: 0.25, standardUsd: 1.25 });
    assert.equal(estimateImport("META_INSTAGRAM", 100).standardUsd, 0);
    assert.equal(estimateImport("META_INSTAGRAM", 100).requests, 2);
  });
});
