import { MAX_HASHTAGS, hashtagCount, siteMentionFree } from "@/lib/dashboard/caption-format";
import type { VitrinCard } from "@/types/vitrin";

/**
 * Vitrin gönderi metni — şablondan (LLM yok, bkz. CLAUDE.md 1.10). Analiz dili, bahis dili yok
 * (kart metinleriyle aynı dil kapısından geçer), link ve alan adı yok (X'te de: kancadaki
 * "checkmatch.net'te" metinde "CheckMatch'te" olur), en fazla 5 hashtag (ortak kapı `caption-format.ts`),
 * sonunda etkileşim sorusu. Admin inceleme ekranında düzenler; onayda metin yine aynı kapılardan geçer.
 */

export { MAX_HASHTAGS, hashtagCount };

export const VITRIN_QUESTION = "Sizce kim kazanır? Yorumlara yazın 👇";

/** "Galatasaray" → "#Galatasaray", "Çaykur Rizespor" → "#ÇaykurRizespor" (harf/rakam dışı atılır). */
export const hashtag = (text: string): string => `#${text.normalize("NFC").replace(/[^\p{L}\p{N}]+/gu, "")}`;

/** Gerekçe karşılaştırma anahtarı: büyük/küçük harf, boşluk ve sondaki noktalama farkı yok sayılır. */
export const reasonKey = (reason: string): string => reason.trim().toLocaleLowerCase("tr-TR").replace(/\s+/gu, " ").replace(/[.!…\s]+$/u, "");

export function buildVitrinCaption(card: VitrinCard): string {
  // Kart adları büyütülmeden (ortak ad kuralının çıktısı): "Borussia Dortmund", "UEFA Şampiyonlar Ligi".
  const { home, away, competition, round } = card.names;
  // Güvenlik ağı: aynı gerekçe iki kutuda olsa da (admin/AI) metinde bir kez yazılır.
  const seen = new Set<string>();
  const boxes = card.open.map((box) => {
    const values = box.lines.map((line) => `${line.label} ${line.value}`).join(" · ");
    const key = reasonKey(box.reason);
    const repeated = key === "" || seen.has(key);
    seen.add(key);
    return repeated ? `📊 ${box.title}: ${values}` : `📊 ${box.title}: ${values}\n${box.reason}`;
  });
  const tags = [...new Set([hashtag(home), hashtag(away), hashtag(competition), "#MaçÖnüAnaliz", "#CheckMatch"])].slice(0, MAX_HASHTAGS);
  const hook = card.hook.map(siteMentionFree);
  return [`${home} – ${away} | Maç önü analiz`, `${competition} · ${round}`, "", ...boxes.flatMap((box) => [box, ""]), ...hook, "", VITRIN_QUESTION, "", tags.join(" ")].join("\n");
}

/**
 * Kart metninde bağlantı var mı (http(s), www. ya da alan adı/yol) — kart görselinde "checkmatch.net" adı yol
 * olmadan serbest. Gönderi metni daha katıdır: çıplak alan adı da link (`caption-format.ts::hasLinkOrDomain`).
 */
export const hasLink = (caption: string): boolean => /https?:\/\/|www\.|\b[\w-]+\.(?:net|com|pro|org)\/\S*/iu.test(caption);
