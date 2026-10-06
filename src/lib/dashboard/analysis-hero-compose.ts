import sharp from "sharp";

/**
 * Derinlemesine Analiz kapağı (1080×460) — sahne + oyuncu kesimi, sharp ile. Katman sırası
 * CLAUDE.md 3.4 ile uyumlu: arka plan → okunabilirlik gölgesi → oyuncu → alt geçiş. Alt kenar
 * kartın lacivert zeminine (#0a1a2f) erir; böylece kapak veri panelleriyle tek parça görünür.
 */
export const HERO_SIZE = { width: 1080, height: 460 } as const;

const NAVY = "#0a1a2f";
const PLAYER_TOP = 24;
const PLAYER_MAX_HEIGHT = 520;
const PLAYER_MAX_WIDTH = 620;
const PLAYER_RIGHT_MARGIN = 24;

const { width: W, height: H } = HERO_SIZE;

function svg(body: string): Buffer {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${body}</svg>`);
}

/** Soldaki başlık alanı için koyulaştırma (oyuncunun altında kalır). */
const LEFT_SHADE = svg(
  `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${NAVY}" stop-opacity="0.9"/><stop offset="0.55" stop-color="${NAVY}" stop-opacity="0"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/>`,
);

/** Alt kenarda kart zeminine geçiş (oyuncunun üstünde — ayaklar panele erir). */
const BOTTOM_FADE = svg(
  `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0.55" stop-color="${NAVY}" stop-opacity="0"/><stop offset="1" stop-color="${NAVY}" stop-opacity="1"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/>`,
);

/** Ekonomik mod sahnesi (Fal.ai yok): lacivert zemin + takım rengi ışık hüzmesi. */
export function buildProgrammaticHeroBackground(colorHex: string): Promise<Buffer> {
  const scene = svg(
    `<defs>
      <radialGradient id="glow" cx="0.72" cy="0.3" r="0.65"><stop offset="0" stop-color="${colorHex}" stop-opacity="0.6"/><stop offset="1" stop-color="${colorHex}" stop-opacity="0"/></radialGradient>
      <linearGradient id="beam" x1="0.6" y1="0" x2="0.85" y2="1"><stop offset="0" stop-color="#ffffff" stop-opacity="0.08"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/></linearGradient>
    </defs>
    <rect width="100%" height="100%" fill="${NAVY}"/><rect width="100%" height="100%" fill="url(#glow)"/>
    <polygon points="${W * 0.55},0 ${W * 0.75},0 ${W},${H} ${W * 0.7},${H}" fill="url(#beam)"/>`,
  );
  return sharp(scene).jpeg({ quality: 90 }).toBuffer();
}

/** Şeffaf kesimin boş kenarlarını atıp kapağa sığdırır; alt kısım kenardan taşar → kırpılır. */
async function preparePlayer(cutout: Buffer): Promise<{ input: Buffer; left: number; top: number }> {
  const trimmed = await sharp(cutout).trim().png().toBuffer();
  const resized = await sharp(trimmed)
    .resize({ height: PLAYER_MAX_HEIGHT, width: PLAYER_MAX_WIDTH, fit: "inside" })
    .png()
    .toBuffer({ resolveWithObject: true });
  const { width, height } = resized.info;
  const visible = Math.min(height, H - PLAYER_TOP);
  const input = await sharp(resized.data).extract({ left: 0, top: 0, width, height: visible }).png().toBuffer();
  return { input, left: Math.max(0, W - width - PLAYER_RIGHT_MARGIN), top: PLAYER_TOP };
}

export async function composeAnalysisHero(background: Buffer, cutout: Buffer): Promise<Buffer> {
  const [scene, player] = await Promise.all([sharp(background).resize(W, H, { fit: "cover" }).png().toBuffer(), preparePlayer(cutout)]);
  return sharp(scene)
    .composite([{ input: LEFT_SHADE }, player, { input: BOTTOM_FADE }])
    .png()
    .toBuffer();
}
