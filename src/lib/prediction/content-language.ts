import { bannedWordsGate } from "@/lib/prediction/banned-words";

/**
 * Bahis dili kapısı — BÜTÜN kartlar için TEK giriş (denetim 2026-10-30; liste `banned-words.ts`). Kartın
 * üzerindeki metin ve gönderi metni aynı yoldan geçer: üretimde (her motor kayıttan önce), onayda
 * (`approval.ts`, her içerik türü) ve yayında (`publish-engine.ts`, platforma giden son metin). Bulgu varsa
 * kart/onay/yayın durur. Bekçi test `tests/unit/content-language.test.ts` bağlanmayan motoru yakalar.
 */

/** Görsel/renk/adres taşıyan alanlar — kart metni değil. */
const NON_TEXT_KEY = /(logo|img|image|url|hex|photo|portrait|face|art|font|src|color|colour|seed|key|id|format|template|style)$/iu;

/** Karttaki görünür metinler: nesnenin bütün dizgileri, alan yoluyla (görsel/renk/adres/kimlik hariç). */
export function cardTexts(card: unknown, path = "kart"): Record<string, string> {
  if (typeof card === "string") {
    const text = card.trim();
    return text && /\p{L}/u.test(text) && !/^(data:|https?:|\/api\/|#)/u.test(text) ? { [path]: text } : {};
  }
  if (Array.isArray(card)) return Object.assign({}, ...card.map((item, index) => cardTexts(item, `${path}.${index}`)));
  if (card && typeof card === "object") {
    return Object.assign({}, ...Object.entries(card).filter(([key]) => !NON_TEXT_KEY.test(key)).map(([key, value]) => cardTexts(value, `${path}.${key}`)));
  }
  return {};
}

/** Kart metni + gönderi metni; bulgu varsa okunur sebep, yoksa null. */
export function contentLanguageGate(input: { card?: unknown; caption?: string | null }): string | null {
  return bannedWordsGate({ ...(input.card === undefined ? {} : cardTexts(input.card)), ...(input.caption ? { "gönderi metni": input.caption } : {}) });
}

export const BANNED_LANGUAGE = "BANNED_LANGUAGE";
