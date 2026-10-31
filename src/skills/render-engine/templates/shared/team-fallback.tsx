import { CARD_SHADE_HEX, channels, contrastRatio, liftLightness, toHex, toHsl, fromHsl } from "@/lib/dashboard/color-math";
import { TYPE_LETTER_SPACING, type FallbackTypePlan } from "@/lib/dashboard/fallback-type";
import { DISPLAY } from "../match-day/shared";

/**
 * FOTOĞRAFSIZ YEDEK TASARIM — bütün kartların ORTAK görünümü (kurucu kararı 2026-10-31: "yedek tasarım boş
 * görünmesin"). Fotoğraf yoksa (arşivde yok, seçilmedi, Fal kesemedi) o takımın yeri şu katmanlarla dolar:
 *   1. Zemin: kart koyusu + TAKIM RENGİ gradyanı (dış kenardan içe, derin tondan koyuya) — ortak renk kuralından
 *      gelen hex (`team-colors`/`club-colors`), burada yeni renk seçilmez.
 *   2. Yayın dokusu: ince çapraz çizgiler (beyaz, çok düşük opaklık).
 *   3. Büyük filigran: logonun BEYAZ siluetiyle (`logo-silhouette.ts`, düz zemin temizlenir — beyaz kutu asla
 *      çıkmaz) panelin dış kenarına taşan dev arma; siluet yoksa logo çok düşük opaklıkla.
 *   4. Tipografi: takım adı, Anton, dev ve soluk (zemin dokusu) — kartın kendi yazısının yerine geçmez. Yer ve punto
 *      GERÇEK ölçüyle planlanır (`lib/dashboard/fallback-type.ts`): kenardan kesilmez, sığmazsa kısa ad, o da
 *      sığmazsa hiç yazılmaz; çapraz posterde çizginin kendi tarafında kalır.
 *   5. Arma: yüzün düşeceği noktada (`focus`) renkli logo, arkasında takım rengi ışık; logo yoksa monogram.
 * Bütün katmanlar SANAT KATMANIDIR (yazı katmanının altında, yerleşim kapısı ölçmez): Satori ile çizilir,
 * sharp ile zemine basılır (`lib/dashboard/team-fallback-art.ts`). `emblem` kipi zeminsiz (şeffaf) çizer —
 * Maç Günü'nde oyuncu kesiminin yerine sahneye konur; `panel` kipi kendi zeminiyle tam dolgudur.
 */

export interface FallbackTeam {
  /** Kart adı (tipografi büyük harfe çevrilmiş verilir). */
  name: string;
  /** Takımın kart rengi (ortak renk kuralından). */
  hex: string;
  /** Renkli logo (`data:` URI); yoksa monogram. */
  logo: string | null;
  /** Logonun beyaz silueti (`data:` URI); yoksa filigran logodan çizilir. */
  watermark: string | null;
}

export type FallbackSide = "home" | "away" | "center";

export interface TeamFallbackProps {
  team: FallbackTeam;
  width: number;
  height: number;
  /** Takımın dış kenarı: ışık ve filigran oraya kayar (ev → sol, deplasman → sağ). */
  side: FallbackSide;
  /** `panel`: kendi zeminiyle tam dolgu; `emblem`: şeffaf zemin (Maç Günü sahnesi). */
  mode?: "panel" | "emblem";
  /** Armanın merkezi (0..1, panele göre) — fotoğrafta yüzün düşeceği nokta. */
  focus?: { x: number; y: number } | undefined;
  /** Dev takım adının planı (`planFallbackType`; null/verilmezse ad yazılmaz). */
  typePlan?: FallbackTypePlan | null | undefined;
  /** Ön plandaki arma (varsayılan açık) — kartın kendi dev yazısı fotoğraf yerindeyse kapatılır (Oyuncu İstatistikleri A dikey). */
  crest?: boolean;
  /** `emblem` kipinde takım rengi ışığın en yüksek opaklığı (Maç Günü: fotoğraflı tarafın arka ışığıyla aynı dil). */
  glowAlpha?: number | undefined;
}

/** Maç Günü emblem kipinde takım rengi ışığın varsayılan opaklığı (eski sarı hale 0,55'ti). */
export const EMBLEM_GLOW_ALPHA = 0.22;

const rgba = (hex: string, alpha: number) => `rgba(${channels(hex).join(",")},${alpha})`;

/** Zeminin derin tonunda beyaz yazının en az kontrastı (ışık ve gradyan üstüne biner — pay bırakılır). */
export const FALLBACK_DEEP_CONTRAST = 7;
/** Işığın en parlak noktasında (derin ton + ışık) beyaz yazının en az kontrastı — WCAG AA. */
export const FALLBACK_GLOW_CONTRAST = 4.5;
/** Açık renk (sarı, beyaz, açık mavi — göreli parlaklık > 0,45): derin ton daha koyu ve daha az doygun. */
const LIGHT_SOURCE_LUMINANCE = 0.45;
const LIGHT_DEEP_CONTRAST = 10;
const LIGHT_DEEP_SATURATION = 0.55;
/** Panel ışığının en yüksek / en düşük opaklığı. */
const GLOW_ALPHA_MAX = 0.5;
const GLOW_ALPHA_MIN = 0.12;
/** Açık renkte ışık bunu geçmez (sarı ışık paneli boğmasın). */
const LIGHT_GLOW_ALPHA_MAX = 0.24;

/** sRGB'de iki rengin karışımı (Satori/sharp alfa birleştirmesiyle aynı). */
export function mixHex(base: string, top: string, alpha: number): string {
  const a = channels(base);
  const b = channels(top);
  return toHex([0, 1, 2].map((i) => Math.round((a[i] ?? 0) * (1 - alpha) + (b[i] ?? 0) * alpha)) as [number, number, number]);
}

export interface FallbackTones {
  /** Zemin gradyanının derin tonu. */
  deep: string;
  /** Işık tonu. */
  glow: string;
  /** Panel ışığının opaklığı — en parlak noktada beyaz yazı okunur kalır. */
  glowAlpha: number;
}

/**
 * Takım renginin derin tonu (zemin) ve parlak tonu (ışık) — ton korunur. Açık ve doygun renklerde (Fenerbahçe
 * sarısı, Göztepe sarısı) derin ton beyaz yazı `FALLBACK_DEEP_CONTRAST`'ı sağlayana dek koyulaşır ve doygunluğu
 * azalır; ışığın opaklığı en parlak noktada `FALLBACK_GLOW_CONTRAST`'ı korur (canlı test v2: 16:9'da sarı panel
 * metni bastırıyordu). Koyu renklerde (kırmızı, lacivert, mor) değerler eskisiyle aynıdır.
 */
export function fallbackTones(hex: string): FallbackTones {
  const [h, s, l] = toHsl(hex);
  // Göreli parlaklık siyaha kontrasttan: (L + 0,05) / 0,05.
  const light = contrastRatio(hex, "#000000") * 0.05 - 0.05 > LIGHT_SOURCE_LUMINANCE;
  const target = light ? LIGHT_DEEP_CONTRAST : FALLBACK_DEEP_CONTRAST;
  let lightness = Math.min(0.32, Math.max(0.16, l * 0.62));
  let saturation = Math.min(light ? LIGHT_DEEP_SATURATION : 1, s * 1.05);
  let deep = fromHsl(h, saturation, lightness);
  while (contrastRatio("#ffffff", deep) < target && lightness > 0.06) {
    lightness -= 0.01;
    // Doygunluk yalnızca AZALIR (renksiz beyaz/gri renk kazanmaz).
    const floor = light ? 0.4 : 0.5;
    if (saturation > floor) saturation = Math.max(floor, saturation - 0.02);
    deep = fromHsl(h, saturation, lightness);
  }
  const glow = liftLightness(hex) ?? fromHsl(h, s, Math.max(l, 0.5));
  let glowAlpha = light ? LIGHT_GLOW_ALPHA_MAX : GLOW_ALPHA_MAX;
  while (glowAlpha > GLOW_ALPHA_MIN && contrastRatio("#ffffff", mixHex(deep, glow, glowAlpha)) < FALLBACK_GLOW_CONTRAST) glowAlpha = Math.round((glowAlpha - 0.02) * 100) / 100;
  return { deep, glow, glowAlpha };
}

/** Çapraz yayın çizgileri (SVG, beyaz, düşük opaklık). */
function Stripes({ width, height, side }: { width: number; height: number; side: FallbackSide }) {
  const step = Math.max(28, Math.round(Math.min(width, height) / 9));
  const lines: { x: number; w: number; a: number }[] = [];
  for (let x = -height, i = 0; x < width + height; x += step, i++) lines.push({ x, w: i % 4 === 0 ? 3 : 1, a: i % 4 === 0 ? 0.07 : 0.035 });
  const dir = side === "away" ? -1 : 1;
  return (
    <svg style={{ position: "absolute", left: 0, top: 0 }} width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {lines.map((line) => (
        <line key={line.x} x1={line.x} y1={dir > 0 ? height : 0} x2={line.x + height * 0.58} y2={dir > 0 ? 0 : height} stroke="#ffffff" strokeOpacity={line.a} strokeWidth={line.w} />
      ))}
    </svg>
  );
}

function Crest({ team, size }: { team: FallbackTeam; size: number }) {
  if (team.logo) {
    // eslint-disable-next-line @next/next/no-img-element -- Satori yalnızca düz <img> okur.
    return <img src={team.logo} alt="" width={size} height={size} style={{ objectFit: "contain" }} />;
  }
  const initials = team.name.replace(/[^\p{L}\p{N} ]/gu, "").split(/\s+/u).filter(Boolean).slice(0, 2).map((word) => word.charAt(0)).join("") || "?";
  const { glow } = fallbackTones(team.hex);
  return (
    <div tw="flex items-center justify-center" style={{ width: size, height: size, borderRadius: size, border: `${Math.max(3, Math.round(size * 0.035))}px solid ${glow}`, backgroundColor: "rgba(7,8,12,0.55)" }}>
      <span style={{ fontFamily: DISPLAY, fontSize: Math.round(size * 0.42), lineHeight: 1, color: "#fff" }}>{initials.toLocaleUpperCase("tr-TR")}</span>
    </div>
  );
}

/** Ön plan armasının kenar uzunluğu (logo kutusu; merkezi `focus`) — Maç Günü yerleşimi de bunu okur. */
export function fallbackCrestSize(width: number, height: number, mode: "panel" | "emblem"): number {
  return Math.round(Math.min(Math.min(width, height) * (mode === "emblem" ? 0.62 : 0.4), width * 0.56));
}

export function TeamFallback({ team, width, height, side, mode = "panel", focus, typePlan, crest: showCrest = true, glowAlpha: emblemGlow }: TeamFallbackProps) {
  const { deep, glow, glowAlpha } = fallbackTones(team.hex);
  const short = Math.min(width, height);
  const fx = Math.round((focus?.x ?? 0.5) * width);
  const fy = Math.round((focus?.y ?? 0.4) * height);
  const crest = fallbackCrestSize(width, height, mode);
  // Filigran: panelin dış kenarına taşan dev arma (kırpılmış görünüm tasarımın parçası).
  const mark = Math.round(mode === "emblem" ? short * 0.98 : Math.max(width, height) * 1.05);
  const markX = mode === "emblem" ? fx - mark / 2 : side === "home" ? fx - mark * 0.62 : side === "away" ? fx - mark * 0.38 : fx - mark / 2;
  const markY = mode === "emblem" ? fy - mark * 0.36 : fy - mark * 0.42;
  const wash = side === "home" ? "to right" : side === "away" ? "to left" : "to bottom";
  const markSrc = team.watermark ?? team.logo;
  return (
    <div tw="relative flex" style={{ width, height, overflow: "hidden", backgroundColor: mode === "panel" ? CARD_SHADE_HEX : "transparent" }}>
      {mode === "panel" ? (
        <>
          <div tw="absolute flex" style={{ left: 0, top: 0, width, height, backgroundImage: `linear-gradient(${wash}, ${rgba(deep, 1)} 0%, ${rgba(deep, 0.78)} 38%, ${rgba(CARD_SHADE_HEX, 0.2)} 100%)` }} />
          <Stripes width={width} height={height} side={side} />
        </>
      ) : null}
      {mode === "panel" ? (
        <div tw="absolute flex" style={{ left: 0, top: 0, width, height, backgroundImage: `radial-gradient(circle at ${fx}px ${fy}px, ${rgba(glow, glowAlpha)} 0%, ${rgba(glow, Math.min(0.16, glowAlpha * 0.4))} ${Math.round(short * 0.34)}px, ${rgba(glow, 0)} ${Math.round(short * 0.62)}px)` }} />
      ) : (
        // Emblem (Maç Günü): sarı hale yok — takım renginin derin tonu geniş ve yumuşak; parlak kenar ışığı
        // fotoğraflı taraftaki oyuncuyla aynı yoldan (siluet arka ışığı) `match-day-compose.ts`'te eklenir.
        <div tw="absolute flex" style={{ left: 0, top: 0, width, height, backgroundImage: `radial-gradient(circle at ${fx}px ${fy}px, ${rgba(team.hex, emblemGlow ?? EMBLEM_GLOW_ALPHA)} 0%, ${rgba(deep, (emblemGlow ?? EMBLEM_GLOW_ALPHA) * 0.5)} ${Math.round(short * 0.3)}px, ${rgba(deep, 0)} ${Math.round(short * 0.66)}px)` }} />
      )}
      {markSrc ? (
        // eslint-disable-next-line @next/next/no-img-element -- Satori yalnızca düz <img> okur.
        <img src={markSrc} alt="" width={mark} height={mark} style={{ position: "absolute", left: Math.round(markX), top: Math.round(markY), objectFit: "contain", opacity: (team.watermark ? 0.11 : 0.06) * (mode === "emblem" ? 0.45 : 1) }} />
      ) : null}
      {typePlan ? (
        <div tw="absolute flex" style={{ left: typePlan.left, top: typePlan.top, height: typePlan.height }}>
          <span style={{ fontFamily: DISPLAY, fontSize: typePlan.size, lineHeight: 1, color: "#ffffff", opacity: 0.07, letterSpacing: typePlan.size * TYPE_LETTER_SPACING, whiteSpace: "nowrap" }}>{typePlan.text}</span>
        </div>
      ) : null}
      {showCrest ? <div tw="absolute flex items-center justify-center" style={{ left: fx - crest, top: fy - crest, width: crest * 2, height: crest * 2, backgroundImage: `radial-gradient(circle, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0.04) ${Math.round(crest * 0.55)}px, rgba(255,255,255,0) ${crest}px)` }}>
        <Crest team={team} size={crest} />
      </div> : null}
      {mode === "panel" ? <div tw="absolute flex" style={{ left: 0, top: 0, width, height, backgroundImage: `linear-gradient(to bottom, ${rgba(CARD_SHADE_HEX, 0)} 52%, ${rgba(CARD_SHADE_HEX, 0.7)} 100%)` }} /> : null}
    </div>
  );
}

/** Küçük yuvarlak rozet (vesikalık yerine: Oyuncu Karşılaştırması 02, Maçın En İyileri) — aynı dil, tek renk zemin. */
export function teamBadgeBackground(hex: string): string {
  const { deep, glow } = fallbackTones(hex);
  return `radial-gradient(circle at 50% 38%, ${rgba(glow, 0.55)} 0%, ${rgba(deep, 0.95)} 62%, ${rgba(CARD_SHADE_HEX, 1)} 100%)`;
}
