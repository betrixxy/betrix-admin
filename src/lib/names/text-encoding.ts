/**
 * Bozuk kodlama onarıcısı (canlı test v3, 2026-10-31): API-Football bazı adları UTF-8 baytları Latin-1 diye
 * okunmuş hâlde verir — "Obrić" → "ObriÄ\u0087" (ć = C4 87). Arşiv senkronu bu adı olduğu gibi yazdı; kartta
 * Satori U+0087 için font aramaya çıkıp "R. OBRIÄ" çiziyordu ve Sportmonks eşleşmesi de kaçıyordu.
 *
 * Kural: metin yalnızca Latin-1 aralığındaysa (≤ U+00FF) ve çift kodlama izi taşıyorsa (C1 kontrol karakteri
 * ya da "Ã©", "Ä\u0087" gibi öncü + devam baytı) baytlar UTF-8 olarak yeniden çözülür; çözüm geçersizse metin
 * aynen kalır, yalnızca C1 kontrol karakterleri atılır (görünmez, fontta yok). Saf fonksiyon, tarayıcıda da çalışır.
 */

const C1 = /[\u0080-\u009f]/gu;
const DOUBLE_ENCODED = /[Â-ß][\u0080-¿]|[à-ï][\u0080-¿]{2}/u;
const decoder = new TextDecoder("utf-8", { fatal: true });

export function repairMojibake(value: string): string {
  if (!DOUBLE_ENCODED.test(value) && !/[\u0080-\u009f]/u.test(value)) return value;
  const codes = [...value].map((char) => char.codePointAt(0) ?? 0);
  if (codes.every((code) => code <= 0xff)) {
    try {
      const decoded = decoder.decode(Uint8Array.from(codes));
      if (decoded !== value) return decoded;
    } catch {
      // geçerli UTF-8 değil — gerçek Latin-1 metin; yalnızca kontrol karakterleri atılır
    }
  }
  return value.replace(C1, "");
}

/** Ham JSON ağacındaki bütün dizgileri onarır (API sınırı; yapı ve diğer değerler aynen). */
export function repairMojibakeDeep(value: unknown): unknown {
  if (typeof value === "string") return repairMojibake(value);
  if (Array.isArray(value)) return value.map(repairMojibakeDeep);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, repairMojibakeDeep(item)]));
  }
  return value;
}
