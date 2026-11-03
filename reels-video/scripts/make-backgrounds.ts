import { mkdirSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { seeded } from "../src/lib/motion";

/**
 * Kurgusal stadyum ve kalabalık zeminleri. Tamamen kodla üretilir: fotoğraf değildir, lisans sorunu yoktur, tekrarlanabilir.
 * Çıktı `public/backgrounds`. `npx tsx scripts/make-backgrounds.ts`
 */

const OUT = path.resolve("public/backgrounds");
const W = 1080;
const H = 1920;
mkdirSync(OUT, { recursive: true });

let seed = 1;
const random = (): number => seeded((seed += 1));

const CROWD = ["#E9E2D0", "#C9D3DE", "#D94A4A", "#3D7BD9", "#E8C547", "#7A8794", "#FFFFFF", "#4A5560"];
const pick = <T,>(items: readonly T[]): T => items[Math.floor(random() * items.length)] as T;

function stadium(): string {
  const parts: string[] = [];
  parts.push(`<defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#03060C"/><stop offset="1" stop-color="#101E30"/></linearGradient>
    <linearGradient id="turf" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1F7A3B"/><stop offset="1" stop-color="#0D3F1F"/></linearGradient>
    <radialGradient id="flood"><stop offset="0" stop-color="#FFFFFF" stop-opacity="0.95"/><stop offset="0.25" stop-color="#E8F2FF" stop-opacity="0.45"/><stop offset="1" stop-color="#E8F2FF" stop-opacity="0"/></radialGradient>
  </defs>`);
  parts.push(`<rect width="${W}" height="${H}" fill="url(#sky)"/>`);
  // Tribün çanağı: uzakta küçük, yakında büyük kişiler.
  const standTop = 430;
  const standBottom = 1190;
  parts.push(`<rect x="0" y="${standTop}" width="${W}" height="${standBottom - standTop}" fill="#0E151F"/>`);
  for (let index = 0; index < 11000; index += 1) {
    const depth = random();
    const y = standTop + depth * (standBottom - standTop);
    const x = random() * W;
    const radius = 1.4 + depth * 3.6;
    parts.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${radius.toFixed(1)}" fill="${pick(CROWD)}" opacity="${(0.28 + random() * 0.6).toFixed(2)}"/>`);
  }
  // Tribün kat ayraçları.
  for (const y of [640, 910]) parts.push(`<rect x="0" y="${y}" width="${W}" height="16" fill="#05080D" opacity="0.8"/><rect x="0" y="${y + 16}" width="${W}" height="5" fill="#9FC8FF" opacity="0.3"/>`);
  // Saha: perspektif şeritler ve çizgiler.
  parts.push(`<rect x="0" y="${standBottom}" width="${W}" height="${H - standBottom}" fill="url(#turf)"/>`);
  for (let index = 0; index < 8; index += 1) {
    const top = standBottom + (index * index) * 12;
    const bottom = standBottom + ((index + 1) * (index + 1)) * 12;
    if (index % 2 === 0) parts.push(`<rect x="0" y="${top}" width="${W}" height="${bottom - top}" fill="#FFFFFF" opacity="0.05"/>`);
  }
  parts.push(`<polygon points="150,1250 930,1250 1250,1920 -170,1920" fill="none" stroke="#FFFFFF" stroke-opacity="0.55" stroke-width="7"/>`);
  parts.push(`<line x1="-40" y1="1500" x2="1120" y2="1500" stroke="#FFFFFF" stroke-opacity="0.5" stroke-width="7"/>`);
  parts.push(`<ellipse cx="540" cy="1500" rx="240" ry="62" fill="none" stroke="#FFFFFF" stroke-opacity="0.5" stroke-width="7"/>`);
  // Projektörler: iki kule, ışık havuzu.
  for (const [towerX, towerY] of [[120, 250], [960, 250]] as const) {
    parts.push(`<circle cx="${towerX}" cy="${towerY}" r="560" fill="url(#flood)" opacity="0.55"/>`);
    for (let row = 0; row < 4; row += 1) for (let col = 0; col < 8; col += 1) parts.push(`<circle cx="${towerX - 70 + col * 20}" cy="${towerY - 30 + row * 20}" r="6.5" fill="#FFFFFF"/>`);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${parts.join("")}</svg>`;
}

function crowdBokeh(): string {
  const parts: string[] = [`<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#160F0A"/><stop offset="0.55" stop-color="#2A1812"/><stop offset="1" stop-color="#0A0705"/></linearGradient></defs>`];
  parts.push(`<rect width="${W}" height="${H}" fill="url(#g)"/>`);
  // Yakın kalabalık: büyük baş ve omuz lekeleri.
  for (let index = 0; index < 900; index += 1) {
    const y = 300 + random() * 1620;
    const size = 16 + ((y - 300) / 1620) * 52;
    const x = random() * W;
    const tone = pick(["#3B2A20", "#6B4A34", "#A07A58", "#20150F", "#7C2B2B", "#2B3F66", "#D8C8A8"]);
    parts.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${size.toFixed(1)}" fill="${tone}" opacity="${(0.35 + random() * 0.5).toFixed(2)}"/>`);
    parts.push(`<ellipse cx="${x.toFixed(1)}" cy="${(y + size * 2).toFixed(1)}" rx="${(size * 1.8).toFixed(1)}" ry="${(size * 1.3).toFixed(1)}" fill="${tone}" opacity="0.5"/>`);
  }
  // Işık lekeleri: telefon ışıkları, meşale.
  for (let index = 0; index < 150; index += 1) {
    const x = random() * W;
    const y = 120 + random() * 1200;
    const radius = 8 + random() * 34;
    parts.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${radius.toFixed(1)}" fill="${pick(["#FFE7B0", "#FFB067", "#FFFFFF", "#FF6A4D"])}" opacity="${(0.25 + random() * 0.55).toFixed(2)}"/>`);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${parts.join("")}</svg>`;
}

for (const [name, svg, sigma] of [["stadium-night", stadium(), 9], ["crowd-bokeh", crowdBokeh(), 11]] as const) {
  const file = path.join(OUT, `${name}.jpg`);
  await sharp(Buffer.from(svg)).blur(sigma).jpeg({ quality: 82, mozjpeg: true }).toFile(file);
  console.log(file);
}
