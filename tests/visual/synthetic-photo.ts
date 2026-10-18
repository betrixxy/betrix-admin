import sharp from "sharp";

/**
 * 3:2 sentetik maç "fotoğrafı": gece tribünü, ışıklar, çim, iki forma silueti (deterministik).
 * Gerçek maç fotoğrafları telifli olduğu için repoya girmez; görsel testler bunu kullanır.
 */
export const SYNTHETIC_PHOTO_SIZE = { width: 2400, height: 1600 } as const;

export async function syntheticPhoto(): Promise<Buffer> {
  const { width: w, height: h } = SYNTHETIC_PHOTO_SIZE;
  const lights = Array.from({ length: 70 }, (_, i) => `<circle cx="${(i * 337) % w}" cy="${90 + ((i * 53) % 520)}" r="${5 + (i % 6)}" fill="#fff" opacity="${0.35 + (i % 4) * 0.15}"/>`).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
    <defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#131c2e"/><stop offset="0.5" stop-color="#3a4660"/><stop offset="0.52" stop-color="#2f6f3a"/><stop offset="1" stop-color="#173f1f"/></linearGradient></defs>
    <rect width="100%" height="100%" fill="url(#s)"/>${lights}
    <rect x="1050" y="560" width="230" height="760" rx="70" fill="#b8122f"/><circle cx="1165" cy="470" r="96" fill="#d9a77f"/>
    <rect x="1380" y="640" width="210" height="700" rx="70" fill="#f2f2f2"/><circle cx="1485" cy="560" r="84" fill="#c9926d"/>
  </svg>`;
  return sharp(Buffer.from(svg)).jpeg({ quality: 92 }).toBuffer();
}
