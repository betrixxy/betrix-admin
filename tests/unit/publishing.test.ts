import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { captionFacts, captionLength, captionWarnings, parsePublishSettings, publishMediaOf, validMediaOrder } from "@/lib/dashboard/publish-caption";

const pair = {
  kind: "PROBABLE_LINEUPS",
  homeImageUrl: "/api/files/renders/home.png",
  awayImageUrl: "/api/files/renders/away.png",
  home: { teamName: "Galatasaray" },
  away: { teamName: "Fenerbahçe" },
};

describe("yayın merkezi — görseller", () => {
  it("iki takımlı kartta ev + deplasman, tek kartta kart, diğerlerinde sonuç görseli", () => {
    assert.deepEqual(publishMediaOf(pair, "/api/files/renders/home.png"), [
      { url: "/api/files/renders/home.png", label: "Galatasaray · Ev sahibi" },
      { url: "/api/files/renders/away.png", label: "Fenerbahçe · Deplasman" },
    ]);
    assert.deepEqual(publishMediaOf({ kind: "WEEKLY_FIXTURES", imageUrl: "/api/files/renders/w.png" }, null), [{ url: "/api/files/renders/w.png", label: "Kart" }]);
    assert.deepEqual(publishMediaOf({ selection: {} }, "/api/files/renders/r.png"), [{ url: "/api/files/renders/r.png", label: "Kart" }]);
    assert.deepEqual(publishMediaOf(null, null), []);
  });

  it("dizilim yalnız taslağın kendi görsellerinden, tekrarsız; tekli düzende tek öğe; X en fazla 4", () => {
    const media = publishMediaOf(pair, null).map((item) => item.url);
    const [home, away] = media as [string, string];
    assert.ok(validMediaOrder([away, home], media, "multi", "IG_POST"));
    assert.ok(validMediaOrder([away], media, "single", "X"));
    assert.equal(validMediaOrder([home, away], media, "single", "IG_POST"), false);
    assert.equal(validMediaOrder([home, home], media, "multi", "IG_POST"), false);
    assert.equal(validMediaOrder(["/api/files/renders/baska.png"], media, "single", "IG_POST"), false);
    assert.equal(validMediaOrder([], media, "multi", "IG_POST"), false);
  });

  it("kayıtlı yayın ayarları okunur; yoksa null", () => {
    assert.deepEqual(parsePublishSettings({ ...pair, publish: { platform: "X", layout: "single", mediaOrder: ["a"] } }), { platform: "X", layout: "single", mediaOrder: ["a"] });
    assert.equal(parsePublishSettings(pair), null);
  });
});

describe("yayın merkezi — metin denetimi", () => {
  const base = "MUHTEMEL 11 | Galatasaray - Fenerbahçe\nSon 5 maçta 2.4 gol ortalaması, %61 topla oynama.";
  const facts = JSON.stringify(captionFacts("Muhtemel 11", base, ["Galatasaray · Ev sahibi"]));

  it("kart verisinde olmayan sayı uyarılır; hashtag içindeki rakam sayılmaz", () => {
    const ok = "#Galatasaray son 5 maçta 2,4 gol ortalamasıyla derbiye hazır. %61 topla oynama dikkat çekiyor #SüperLig2026";
    assert.deepEqual(captionWarnings(ok, "X", facts), []);
    const bad = "#Galatasaray son 7 maçta 3.1 gol attı #SüperLig";
    assert.match(captionWarnings(bad, "X", facts)[0] ?? "", /7, 3\.1/);
  });

  it("X sınırı: emoji 2 karakter sayılır; aşınca ve hashtag aralığı dışında uyarı", () => {
    assert.equal(captionLength("Gol ⚽", "X"), 6);
    assert.equal(captionLength("Gol ⚽", "IG_POST"), 5);
    const long = `#Galatasaray #SüperLig ${"a".repeat(300)}`;
    assert.ok(captionWarnings(long, "X", facts).some((warning) => warning.includes("280")));
    assert.ok(captionWarnings("Kısa metin #Galatasaray", "IG_POST", facts).some((warning) => warning.includes("5-8")));
  });
});
