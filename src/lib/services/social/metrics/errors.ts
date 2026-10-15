/**
 * Sağlayıcı hata mesajlarının sınıflandırılması — iş kuyruğu yeniden deneme / durdurma kararını buna göre
 * verir. Mesajlar `shared/http.ts::describeErrorBody` biçimindedir (`HTTP 400 … (type=… code=… error_subcode=…)`),
 * token veya URL içermez. Saf fonksiyonlar.
 */

export type ProviderErrorKind =
  /** Token geçersiz/süresi dolmuş, izin geri alınmış — yeniden bağlanmadan düzelmez. */
  | "AUTH"
  /** Nesne yok: gönderi silinmiş, story süresi dolmuş. */
  | "GONE"
  /** İstek geçersiz (ör. desteklenmeyen metrik). */
  | "INVALID_REQUEST"
  /** Hız/kredi sınırı — daha sonra. */
  | "RATE_LIMIT"
  | "OTHER";

const field = (message: string, name: string): string | null => new RegExp(`\\b${name}=(\\d+)`).exec(message)?.[1] ?? null;
const httpStatus = (message: string): number | null => {
  const match = /HTTP (\d{3})/.exec(message);
  return match?.[1] ? Number(match[1]) : null;
};

/**
 * Meta Graph API: 190/102 = token, 200 = izin, 4/17/32/613 = hız limiti, 100+33 = nesne yok. Code 10 hem
 * "izin yok" hem "story metriği 5'in altında" için döner — durdurmamak için geçersiz istek sayılır.
 */
export function classifyMetaError(message: string): ProviderErrorKind {
  const code = field(message, "code");
  const subcode = field(message, "error_subcode");
  if (code === "190" || code === "102" || code === "200") return "AUTH";
  if (code === "4" || code === "17" || code === "32" || code === "613") return "RATE_LIMIT";
  if (code === "100" && subcode === "33") return "GONE";
  if (code === "100" || code === "10") return "INVALID_REQUEST";
  const status = httpStatus(message);
  if (status === 401 || status === 403) return "AUTH";
  if (status === 404) return "GONE";
  if (status === 429) return "RATE_LIMIT";
  return "OTHER";
}

/** X API v2: 401/403 yetki, 429 hız/kredi (bakiye bitti), 400 geçersiz istek. */
export function classifyXError(message: string): ProviderErrorKind {
  const status = httpStatus(message);
  if (status === 401 || status === 403) return "AUTH";
  if (status === 429 || status === 402) return "RATE_LIMIT";
  if (status === 400) return "INVALID_REQUEST";
  if (status === 404) return "GONE";
  return "OTHER";
}
