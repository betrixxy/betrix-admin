import type { VitrinCard } from "@/types/vitrin";

/**
 * Vitrin gönderi metni — şablondan (LLM yok, bkz. CLAUDE.md 1.10). Analiz dili, bahis dili yok
 * (kart metinleriyle aynı dil kapısından geçer), link yok (X'te de), en fazla 5 hashtag, sonunda
 * etkileşim sorusu. Admin inceleme ekranında düzenler; onayda metin yine dil kapısından geçer.
 */

export const VITRIN_QUESTION = "Sizce kim kazanır? Yorumlara yazın 👇";
export const MAX_HASHTAGS = 5;

/** "Galatasaray" → "#Galatasaray", "Çaykur Rizespor" → "#ÇaykurRizespor" (harf/rakam dışı atılır). */
export const hashtag = (text: string): string => `#${text.normalize("NFC").replace(/[^\p{L}\p{N}]+/gu, "")}`;

export function buildVitrinCaption(card: VitrinCard): string {
  // Kart adları büyütülmeden (ortak ad kuralının çıktısı): "Borussia Dortmund", "UEFA Şampiyonlar Ligi".
  const { home, away, competition, round } = card.names;
  const boxes = card.open.map((box) => {
    const values = box.lines.map((line) => `${line.label} ${line.value}`).join(" · ");
    return `📊 ${box.title}: ${values}\n${box.reason}`;
  });
  const tags = [...new Set([hashtag(home), hashtag(away), hashtag(competition), "#MaçÖnüAnaliz", "#CheckMatch"])].slice(0, MAX_HASHTAGS);
  return [`${home} – ${away} | Maç önü analiz`, `${competition} · ${round}`, "", ...boxes.flatMap((box) => [box, ""]), card.hook[0], card.hook[1], "", VITRIN_QUESTION, "", tags.join(" ")].join("\n");
}

/** Metindeki hashtag sayısı (test ve inceleme uyarısı). */
export const hashtagCount = (caption: string): number => (caption.match(/(^|\s)#[\p{L}\p{N}_]+/gu) ?? []).length;

/** Metinde bağlantı var mı (http(s), www. ya da alan adı/yol). "checkmatch.net" adı yol olmadan serbest. */
export const hasLink = (caption: string): boolean => /https?:\/\/|www\.|\b[\w-]+\.(?:net|com|pro|org)\/\S*/iu.test(caption);
