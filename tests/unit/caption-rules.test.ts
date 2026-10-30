import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { captionFormatGate, hashtagCount, MAX_HASHTAGS } from "@/lib/dashboard/caption-format";
import { BRAND_TAG, captionHashtags, competitionTag, FALLBACK_TAG, MIN_HASHTAGS, toTag } from "@/lib/dashboard/caption-hashtags";
import { buildLineupCaption } from "@/lib/dashboard/lineup-caption";
import { buildMatchDayCaption } from "@/lib/dashboard/match-day-caption";
import { captionLength } from "@/lib/dashboard/publish-caption";
import { MORE_LINE, shortenLine, templateCaption, tidyCaption, X_LIMIT, xCaptionFrom } from "@/lib/dashboard/x-caption";
import { findBannedWords } from "@/lib/prediction/banned-words";
import { contentLanguageGate } from "@/lib/prediction/content-language";
import { worstCaseCaptions } from "../fixtures/captions";

/**
 * Gönderi metni kuralları (canlı test 2026-10-31, maddeler 13–15): her kart türünün Instagram metni 3–5 ilgili
 * hashtag taşır; X sürümü yapay zekâsız, kural tabanlı ve ≤ 280 (emoji 2 sayılır); biçim bekçisi ("Top
 * hakimiyeti:%46", "gol bulur mu?:", çift boşluk, noktalamadan önce boşluk). En kötü durum metinleri
 * `tests/fixtures/captions.ts`. Bu dosya `match-day-caption.ts` ve `lineup-caption.ts` kurucularını da
 * `captionFormatGate(` ile bağlar (bekçi `caption-format.test.ts`).
 */

const CASES = worstCaseCaptions();
const TYPES = ["MATCH_DAY", "WEEKLY_FIXTURES", "PROBABLE_LINEUPS", "AI_MARKET_PREDICTION", "PLAYER_H2H", "DRAWS_AND_PAIRINGS", "MATCH_RESULT", "MATCH_STATS", "PLAYER_STATS", "MATCH_ANALYSIS", "PREDICTION_SCORECARD", "STANDINGS"];

/** Biçim hataları: iki nokta sonrası boşluksuz (saat/oran hariç), "?:", çift boşluk, noktalamadan önce boşluk, satır sonu boşluğu. */
function formatProblems(text: string): string[] {
  const problems: string[] = [];
  for (const line of text.split("\n")) {
    if (/(?<!\d):(?=\S)|:(?=[^\s\d])/u.test(line)) problems.push(`iki nokta sonrası boşluk yok: ${line}`);
    if (/\?:/u.test(line)) problems.push(`"?:": ${line}`);
    if (/\S {2,}/u.test(line)) problems.push(`çift boşluk: ${line}`);
    if (/\s[,.;:!?](?:\s|$)/u.test(line)) problems.push(`noktalamadan önce boşluk: ${line}`);
    if (/\s$/u.test(line)) problems.push(`satır sonu boşluğu: ${JSON.stringify(line)}`);
  }
  return problems;
}

describe("hashtag kuralı — ortak yardımcı", () => {
  it("ad → etiket: boşluk/noktalama atılır, Türkçe harf korunur", () => {
    assert.equal(toTag("Çaykur Rizespor"), "#ÇaykurRizespor");
    assert.equal(toTag("Göztepe SK"), "#GöztepeSK");
    assert.equal(toTag("Brighton & Hove Albion"), "#BrightonHoveAlbion");
    assert.equal(toTag("S. Mbangula"), "#Mbangula");
    assert.equal(toTag(" "), null);
  });

  it("turnuva: tablonun kısa adı; büyük harfli künye de çözülür; tabloda olmayan büyük harf etiket olmaz", () => {
    for (const name of ["Trendyol Süper Lig", "TRENDYOL SÜPER LİG", "Süper Lig"]) assert.equal(competitionTag(name), "#SüperLig", name);
    assert.equal(competitionTag("SERIE A"), "#SerieA");
    assert.equal(competitionTag("UEFA Şampiyonlar Ligi"), "#ŞampiyonlarLigi");
    assert.equal(competitionTag("Eredivisie"), "#Eredivisie");
    assert.equal(competitionTag("KUPA BİLİNMEYEN"), null);
  });

  it("3–5 etiket, tekrar yok, tür + marka sonda; özel etiket yoksa #Futbol", () => {
    assert.deepEqual(captionHashtags({ names: ["Galatasaray", "Galatasaray"], competitions: ["Trendyol Süper Lig"], type: "#MaçSonucu" }), ["#Galatasaray", "#SüperLig", "#MaçSonucu", BRAND_TAG]);
    assert.deepEqual(captionHashtags({ type: "#TahminKarnesi" }), [FALLBACK_TAG, "#TahminKarnesi", BRAND_TAG]);
    const many = captionHashtags({ names: ["A1", "B2", "C3", "D4"], competitions: ["Serie A"], type: "#Kura" });
    assert.equal(many.length, MAX_HASHTAGS);
    assert.deepEqual(many.slice(-2), ["#Kura", BRAND_TAG]);
  });
});

describe("Instagram metni — her tür 3–5 hashtag, kapıdan geçer", () => {
  it("bütün aktif içerik türleri en kötü durum metniyle temsil ediliyor", () => {
    for (const type of TYPES) assert.ok(CASES.some((item) => item.type.startsWith(type)), type);
  });

  for (const { type, caption } of CASES) {
    it(type, () => {
      const tags = hashtagCount(caption);
      assert.ok(tags >= MIN_HASHTAGS && tags <= MAX_HASHTAGS, `${tags} hashtag\n${caption}`);
      assert.equal(new Set(caption.match(/#[\p{L}\p{N}_]+/gu)).size, tags, "tekrar eden hashtag");
      assert.equal(captionFormatGate(caption, "IG_POST"), null, caption);
      assert.equal(contentLanguageGate({ caption }), null, caption);
      assert.deepEqual(formatProblems(caption), []);
    });
  }

  it("Maç Günü ve Muhtemel 11 kurucuları (motordan ayrıldı) kapıdan geçer", () => {
    const matchDay = CASES.find((item) => item.type === "MATCH_DAY")?.caption ?? "";
    assert.equal(captionFormatGate(matchDay), null);
    assert.ok(typeof buildMatchDayCaption === "function" && typeof buildLineupCaption === "function");
    assert.match(matchDay, /#SüperLig|#KonferansLigi/u);
  });
});

describe("X sürümü — kural tabanlı, ≤ 280, AI'sız", () => {
  for (const { type, caption } of CASES) {
    it(type, () => {
      const x = xCaptionFrom(caption);
      assert.ok(captionLength(x, "X") <= X_LIMIT, `${captionLength(x, "X")} karakter\n${x}`);
      assert.equal(captionFormatGate(x, "X"), null, x);
      assert.equal(contentLanguageGate({ caption: x, platform: "X" }), null, x);
      const tags = hashtagCount(x);
      assert.ok(tags >= 2 && tags <= 3, `${tags} hashtag\n${x}`);
      assert.ok(x.includes(BRAND_TAG));
      // Başlık (skor / ana olgu) her zaman ilk satırda, kesilmeden.
      assert.equal(x.split("\n")[0], caption.split("\n")[0]);
      assert.deepEqual(formatProblems(x), []);
      assert.deepEqual(findBannedWords(x), []);
    });
  }

  it("kısa metin olduğu gibi kalır (yalnızca 3 hashtag); uzun liste ayraçtan kısalır, sözcük ortadan kesilmez", () => {
    const short = "MAÇ SONUCU | Konyaspor 0-4 Galatasaray\nTrendyol Süper Lig · 10. Hafta\n\nSoru? Yorumlara yazın 👇\n\n#Konyaspor #Galatasaray #SüperLig #MaçSonucu #CheckMatch";
    assert.equal(xCaptionFrom(short), "MAÇ SONUCU | Konyaspor 0-4 Galatasaray\nTrendyol Süper Lig · 10. Hafta\nSoru? Yorumlara yazın 👇\n#Konyaspor #Galatasaray #CheckMatch");
    assert.equal(shortenLine("Fenerbahçe (4-2-3-1): Ederson, L. Mercan, A. Brown, M. Škriniar", 50), "Fenerbahçe (4-2-3-1): Ederson, L. Mercan, …");
    assert.equal(shortenLine("Çok uzun bir başlık satırı burada bitiyor", 20), "Çok uzun bir başlık…");
  });

  it("satır düşünce \"Tamamı görselde.\"; altı kalmamış ara başlık bırakılmaz", () => {
    const standings = CASES.find((item) => item.type === "STANDINGS groups")?.caption ?? "";
    const x = xCaptionFrom(standings);
    assert.ok(x.includes(MORE_LINE), x);
    const lines = x.split("\n");
    const beforeMore = lines[lines.indexOf(MORE_LINE) - 1] ?? "";
    assert.doesNotMatch(beforeMore, /GRUBU$/u, x);
  });

  it("eski kayıt (hashtagsiz, biçim hatalı) da ≤ 280 ve düzeltilmiş: yalnızca marka etiketi", () => {
    const old = ["MAÇ İSTATİSTİKLERİ | Konyaspor 0-4 Galatasaray", "Trendyol Süper Lig · 10. Hafta", "📊 Top hakimiyeti:%46 – %54", "📊 Beklenen gol (xG):1,31 – 2,66"].join("\n");
    const x = xCaptionFrom(old);
    assert.match(x, /Top hakimiyeti: %46 – %54\n📊 Beklenen gol \(xG\): 1,31 – 2,66/u);
    assert.ok(x.endsWith(BRAND_TAG));
  });

  it("Yayın Merkezi başlangıç metni: X'te türetilmiş sürüm, Instagram'da biçimi düzeltilmiş şablon", () => {
    const caption = "📊 İki takım da gol bulur mu?: Evet %69\nSaat 19:00 , oran 2:1  ve link https://x\n#A #B #C";
    assert.equal(templateCaption(caption, "IG_POST"), "📊 İki takım da gol bulur mu? Evet %69\nSaat 19:00, oran 2:1 ve link https://x\n#A #B #C");
    assert.equal(templateCaption(caption, "IG_REELS_STORY"), tidyCaption(caption));
    assert.equal(templateCaption(caption, "X"), xCaptionFrom(caption));
  });
});

describe("biçim bekçisi — kendini doğrular", () => {
  it("canlı testteki hatalar yakalanır; saat ve oran serbest", () => {
    assert.equal(formatProblems("📊 Top hakimiyeti:%46 – %54").length, 1);
    assert.equal(formatProblems("Beklenen gol (xG):1,31 – 2,66").length, 1);
    assert.equal(formatProblems("İki takım da gol bulur mu?: Evet %69").length, 1);
    assert.equal(formatProblems("📅 31 Ekim  ⏰ 19:00").length, 1);
    assert.deepEqual(formatProblems("13:30 Erzurumspor - Çorum FK · skor 2:1 · Puan: API-Football"), []);
  });
});
