/**
 * Sağlayıcı metni ORTAK TEMİZLEYİCİ (canlı test v3, 2026-10-31) — API-Football ve Sportmonks'tan gelen BÜTÜN
 * dizgiler (ad, takım, stadyum, hakem, tur…) istemci sınırında buradan geçer (`sanitizeProviderTree`).
 *
 * Sıra: (1) bozuk kodlama onarımı — UTF-8 baytları Latin-1 okunmuş ad ("Obrić" → "ObriÄ" + U+0087) yalnızca
 * Latin-1 aralığında ve geçerli UTF-8'e çözülüyorsa geri çevrilir; (2) C0/C1 kontrol karakterleri ve sıfır
 * genişlikli / yön karakterleri silinir (Satori bunlar için font arar, ad eşleşmesi kaçar); (3) boşluklar
 * normalleşir: sekme / satır sonu / bölünmez ve özel genişlikli boşluklar tek boşluk, ardışık boşluk teke iner,
 * baş/son boşluk atılır. Saf fonksiyon, tarayıcıda da çalışır. Test `tests/unit/text-encoding.test.ts`.
 */

const DOUBLE_ENCODED = /[\u00c2-\u00df][\u0080-\u00bf]|[\u00e0-\u00ef][\u0080-\u00bf]{2}/u;
const CONTROL = /[\u0080-\u009f]/u;
const decoder = new TextDecoder("utf-8", { fatal: true });

/** C0 (sekme/satır sonu hariç — onlar boşluk olur), DEL, C1, sıfır genişlikli ve yön karakterleri, BOM. */
const INVISIBLE = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u00ad\u200b-\u200f\u202a-\u202e\u2060-\u2064\u2066-\u206f\ufeff]/gu;
/** Boşluk sayılanlar: sekme, satır sonları, NBSP, özel genişlikli boşluklar, satır/paragraf ayırıcı. */
const SPACES = /[\t\n\r\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000 ]+/gu;

/** Bozuk kodlama onarımı (yalnız çift kodlama izi varsa; çözülemezse metin aynen). */
export function repairMojibake(value: string): string {
  if (!DOUBLE_ENCODED.test(value) && !CONTROL.test(value)) return value;
  const codes = [...value].map((char) => char.codePointAt(0) ?? 0);
  if (!codes.every((code) => code <= 0xff)) return value;
  try {
    return decoder.decode(Uint8Array.from(codes));
  } catch {
    return value; // geçerli UTF-8 değil — gerçek Latin-1 metin
  }
}

/** Görünmez karakterleri siler, boşlukları normalleştirir (onarım dahil). */
export function sanitizeProviderText(value: string): string {
  return repairMojibake(value).replace(INVISIBLE, "").replace(SPACES, " ").trim();
}

/** Ham JSON ağacındaki bütün dizgileri temizler (API sınırı; yapı, anahtarlar ve diğer değerler aynen). */
export function sanitizeProviderTree(value: unknown): unknown {
  if (typeof value === "string") return sanitizeProviderText(value);
  if (Array.isArray(value)) return value.map(sanitizeProviderTree);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, sanitizeProviderTree(item)]));
  }
  return value;
}

/** Render sınırı ve arşiv kayıtları için: onarım + görünmez karakter silme (boşluk düzenine dokunmaz). */
export function stripInvisible(value: string): string {
  return repairMojibake(value).replace(INVISIBLE, "");
}
