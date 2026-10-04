/** Görsel yükleme sınırları — istemci ve sunucu ortak (sunucu bağımlılığı yok). */

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
/**
 * Oyuncu fotoğrafı için kabul edilen en küçük kısa kenar. Bunun altı yüz/forma detayı taşımaz;
 * PLAYER_TARGET_SHORT_SIDE'ın altındaki her görsel birefnet'ten önce AI upscale'den geçer
 * (bkz. CLAUDE.md 3.1 adım 1, `lib/dashboard/player-upscale.ts`).
 */
export const PLAYER_MIN_SHORT_SIDE = 256;
/** birefnet'in temiz kenar üretmesi için hedeflenen kısa kenar — altındaki görseller büyütülür. */
export const PLAYER_TARGET_SHORT_SIDE = 1024;
