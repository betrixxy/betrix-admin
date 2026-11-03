import { useEffect, type CSSProperties, type ReactNode } from "react";
import { AbsoluteFill, continueRender, delayRender, Easing, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { cropFor, focusOrigin, placeCrop } from "../lib/crop";
import { AUDIT_PREFIX, measureDom } from "../lib/dom-audit";
import { buildTimeline, CONTENT_WIDTH, HEIGHT, LINE2_DELAY_FRAMES, SAFE, TYPE, WIDTH, ZONES } from "../lib/motion";
import type { PhotoSlot } from "../lib/photo-layouts";
import type { ReelPhoto, ReelScript } from "../schema";
import { FONT_FILES, FONTS, teamName } from "./typography";

export const COLORS = { ground: "#0A0F0C", surface: "#131A16", border: "rgba(255,255,255,0.13)", ink: "#FFFFFF", ink2: "#C4CEC8", ink3: "#93A099", draw: "#8E9A94", track: "rgba(255,255,255,0.12)" } as const;
export const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

const NOISE = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='320' height='320'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 .55 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`;

/**
 * Zemin bütün 1080×1920'yi doldurur (güvenli alanlar yalnız metin içindir): biçilmiş çim şeritleri, saha çizgileri,
 * yeşil ışık, köşelerde takım rengi vurgusu, ince kum. Takım rengi yalnız köşelerdedir, tam ekran gradyan yoktur.
 */
export function Backdrop({ script }: { script: ReelScript }) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const accent = script.brand.accent;
  const home = script.meta.teams.home.colors.primary;
  const away = script.meta.teams.away.colors.primary;
  const push = interpolate(frame, [0, durationInFrames], [1, 1.05], clamp);
  const line = { stroke: "rgba(255,255,255,0.075)", strokeWidth: 4, fill: "none" };
  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.ground }}>
      <AbsoluteFill style={{ background: "repeating-linear-gradient(180deg, rgba(255,255,255,0.016) 0 160px, transparent 160px 320px)" }} />
      <AbsoluteFill style={{ background: [
        `radial-gradient(ellipse 110% 56% at 50% 46%, ${accent}30 0%, ${accent}12 52%, transparent 80%)`,
        `radial-gradient(ellipse 100% 24% at 50% 100%, ${accent}38 0%, transparent 100%)`,
        `radial-gradient(ellipse 100% 18% at 50% 0%, ${accent}2C 0%, transparent 100%)`,
        `radial-gradient(ellipse 62% 22% at 0% 0%, ${home}44 0%, transparent 100%)`,
        `radial-gradient(ellipse 62% 22% at 100% 0%, ${away}44 0%, transparent 100%)`,
        `radial-gradient(ellipse 62% 22% at 0% 100%, ${home}44 0%, transparent 100%)`,
        `radial-gradient(ellipse 62% 22% at 100% 100%, ${away}44 0%, transparent 100%)`,
      ].join(", ") }} />
      <svg width={WIDTH} height={HEIGHT} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} style={{ position: "absolute", inset: 0, transform: `scale(${push})` }}>
        <rect x={40} y={40} width={WIDTH - 80} height={HEIGHT - 80} {...line} />
        <line x1={40} y1={HEIGHT / 2} x2={WIDTH - 40} y2={HEIGHT / 2} {...line} />
        <circle cx={WIDTH / 2} cy={HEIGHT / 2} r={190} {...line} />
        <rect x={210} y={40} width={660} height={300} {...line} />
        <rect x={370} y={40} width={340} height={110} {...line} />
        <rect x={210} y={HEIGHT - 340} width={660} height={300} {...line} />
        <rect x={370} y={HEIGHT - 150} width={340} height={110} {...line} />
      </svg>
      <AbsoluteFill style={{ backgroundImage: NOISE, opacity: 0.07 }} />
    </AbsoluteFill>
  );
}

/** Sabit HUD: sol üst logo, sağ üst maç etiketi, altta sahne sahne dolan ilerleme çubuğu. */
export function Hud({ script }: { script: ReelScript }) {
  const frame = useCurrentFrame();
  const { home, away } = script.meta.teams;
  const { entries } = buildTimeline(script.scenes.map((scene) => scene.durationInFrames));
  return (
    <>
      <div style={{ position: "absolute", left: SAFE.left, width: CONTENT_WIDTH, top: ZONES.hudTop, height: 44, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Img src={staticFile(script.brand.logo)} style={{ height: 44, width: "auto" }} />
        <div style={{ ...teamName(34), color: COLORS.ink2, fontVariantNumeric: "tabular-nums" }}>{home.shortName} – {away.shortName} · {script.meta.match.kickoffLabel}</div>
      </div>
      <div style={{ position: "absolute", left: SAFE.left, width: CONTENT_WIDTH, top: ZONES.progressTop, height: 6, display: "flex", gap: 4 }}>
        {entries.map((entry, index) => (
          <div key={index} style={{ flex: 1, background: "rgba(255,255,255,0.32)", boxShadow: "0 0 0 2px rgba(0,0,0,0.4)", borderRadius: 3, overflow: "hidden" }}>
            <div style={{ height: "100%", background: script.brand.accent, width: `${interpolate(frame, [entry.from, entry.from + entry.duration - 8], [0, 100], clamp)}%` }} />
          </div>
        ))}
      </div>
    </>
  );
}

/** Dar büyük harfte ortalama harf genişliği ~0,47 em; uzun adlar sığsın diye küçülür. */
const fitSize = (text: string): number => Math.min(TYPE.title, Math.floor(860 / (text.length * 0.47)));

export function useReveal(start: number, distance = 22): CSSProperties {
  const frame = useCurrentFrame();
  return {
    opacity: interpolate(frame, [start, start + 8], [0, 1], clamp),
    transform: `translateY(${interpolate(frame, [start, start + 12], [distance, 0], { ...clamp, easing: Easing.out(Easing.cubic) })}px)`,
  };
}

/**
 * Başlık: dar, büyük harf; kök `lang="tr"` olduğu için i→İ, ı→I doğru çevrilir. 1. satır beyaz, 2. satır yeşil ve
 * ~300 ms sonra. `still`: kapakta ilk kare tam dolu. `weight`: kapakta takım adları yarı kalın.
 */
export function Title({ line1, line2, accent, start = 6, still = false, weight = 800 }: { line1: string; line2: string; accent: string; start?: number; still?: boolean; weight?: number }) {
  const size = Math.min(fitSize(line1), fitSize(line2));
  const first = useReveal(start);
  const second = useReveal(start + LINE2_DELAY_FRAMES);
  return (
    <div style={{ position: "absolute", left: SAFE.left, width: CONTENT_WIDTH, top: ZONES.titleTop, fontFamily: FONTS.display, fontWeight: weight, fontSize: size, lineHeight: 0.98, textTransform: "uppercase", whiteSpace: "nowrap" }}>
      <div style={{ color: COLORS.ink, ...(still ? {} : first) }}>{line1}</div>
      <div style={{ color: accent, ...(still ? {} : second) }}>{line2}</div>
    </div>
  );
}

/** Ana görsel bölgesi: hafif kamera itişi güvenli alanın dışına taşmaz (içeri doğru başlar, tam boyda biter). */
export function Main({ children, style, top = ZONES.mainTop, height = ZONES.mainHeight }: { children: ReactNode; style?: CSSProperties; top?: number; height?: number }) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const push = interpolate(frame, [0, durationInFrames - 8], [0.985, 1], clamp);
  return <div style={{ position: "absolute", left: SAFE.left, width: CONTENT_WIDTH, top, height, display: "flex", flexDirection: "column", fontFamily: FONTS.body, color: COLORS.ink, transform: `scale(${push})`, ...style }}>{children}</div>;
}

export function Strip({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <div style={{ position: "absolute", left: SAFE.left, width: CONTENT_WIDTH, top: ZONES.stripTop, height: ZONES.stripHeight, display: "flex", gap: 14, fontFamily: FONTS.body, color: COLORS.ink, ...style }}>{children}</div>;
}

/** Düz koyu yüzey, ince kenarlık, 24 px köşe. */
export function Card({ name, children, style, edge }: { name: string; children: ReactNode; style?: CSSProperties; edge?: string | undefined }) {
  return <div data-block={name} style={{ background: COLORS.surface, border: `2px solid ${edge ?? COLORS.border}`, borderRadius: 24, padding: "18px 24px", display: "flex", flexDirection: "column", minWidth: 0, ...style }}>{children}</div>;
}

export function Crest({ src, size }: { src: string; size: number }) {
  return <Img src={staticFile(src)} style={{ width: size, height: size, objectFit: "contain", flexShrink: 0 }} />;
}

/** Takım rengi işaret: rakam beyaz kalır, kimliği bu taşır. */
export const Swatch = ({ color, size = 20 }: { color: string; size?: number }) => <span style={{ display: "inline-block", width: size, height: size, borderRadius: 6, background: color, flexShrink: 0 }} />;

export function Bar({ fraction, color, height = 16 }: { fraction: number; color: string; height?: number }) {
  return (
    <div style={{ height, background: COLORS.track, borderRadius: height / 2, overflow: "hidden", width: "100%" }}>
      <div style={{ height: "100%", width: `${Math.max(0, Math.min(1, fraction)) * 100}%`, background: color, borderRadius: height / 2 }} />
    </div>
  );
}

const MASK = "linear-gradient(#000 52%, transparent 100%)";

/**
 * Şeffaf kesim: takım rengiyle duotone, zemine eriyen alt kenar, yavaş zoom ve parallax. Tonlama render anındadır,
 * arşiv nötr kalır. Yüz kutuları metadata'dan gelir ve `data-face` ile ölçüme girer.
 */
export function Cutout({ photo, color, slot, drift = 0, opacity = 1, fade = true }: { photo: ReelPhoto; color: string; slot: PhotoSlot; drift?: number; opacity?: number; fade?: boolean }) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const progress = frame / Math.max(1, durationInFrames);
  const place = placeCrop(cropFor(photo, slot.frame), photo.aspect, slot.frame);
  const origin = focusOrigin(photo, slot.frame);
  const src = staticFile(photo.src);
  const silhouette: CSSProperties = { position: "absolute", inset: 0, WebkitMaskImage: `url("${src}")`, WebkitMaskSize: "100% 100%", maskImage: `url("${src}")`, maskSize: "100% 100%" };
  return (
    <div style={{ position: "absolute", left: slot.left, top: slot.top, width: slot.frame.width, height: slot.frame.height, overflow: "hidden", opacity, transform: `translateX(${drift * progress}px) scale(${1 + 0.035 * progress}) ${slot.flip ? "scaleX(-1)" : ""}`, transformOrigin: `${origin.x}% ${origin.y}%`, ...(fade ? { WebkitMaskImage: MASK, maskImage: MASK } : {}) }}>
      <div style={{ position: "absolute", ...place, isolation: "isolate" }}>
        <Img src={src} style={{ width: "100%", height: "100%", filter: "grayscale(1) contrast(1.1) brightness(0.92)" }} />
        <div style={{ ...silhouette, mixBlendMode: "color", background: color }} />
        <div style={{ ...silhouette, mixBlendMode: "soft-light", background: `linear-gradient(170deg, #FFFFFF, ${color} 50%, #000000)` }} />
        {photo.faces.map((face, index) => (
          <div key={index} data-face="" style={{ position: "absolute", left: `${face.x * 100}%`, top: `${face.y * 100}%`, width: `${face.width * 100}%`, height: `${face.height * 100}%` }} />
        ))}
      </div>
    </div>
  );
}

const PAIR_MASK = "linear-gradient(#000 72%, transparent 100%)";

/** Üst üste binen iki oyuncu birlikte erir: alttaki, üsttekinin saydam bölgesinden görünüp leke yapmaz. */
export const PhotoPair = ({ children }: { children: ReactNode }) => <AbsoluteFill style={{ WebkitMaskImage: PAIR_MASK, maskImage: PAIR_MASK }}>{children}</AbsoluteFill>;

/**
 * Bütün font dosyaları yüklenene kadar bekler. `fonts.ready` ve `fonts.load` yetmez: `loadFont` yüzü sayfaya sonradan ekler,
 * eklenmemiş fontu beklemezler; ölçüm yedek fontla yapılır, kutular kayar.
 */
async function allFontsLoaded(): Promise<void> {
  const deadline = Date.now() + 20_000;
  while ([...document.fonts].filter((face) => face.status === "loaded").length < FONT_FILES.length) {
    if (Date.now() > deadline) throw new Error("Fontlar yüklenemedi, denetim yapılamaz.");
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  await document.fonts.ready;
}

/** Render denetimi: kare çizildikten sonra gerçek kutuları konsola yazar. Yalnız tek kare denetiminde açılır. */
export function AuditProbe() {
  const frame = useCurrentFrame();
  useEffect(() => {
    const handle = delayRender("yerleşim denetimi");
    void allFontsLoaded().then(() => {
      const root = document.querySelector("[data-reel-root]");
      if (root) console.log(AUDIT_PREFIX + JSON.stringify({ frame, audit: measureDom(root) }));
      continueRender(handle);
    });
  }, [frame]);
  return null;
}
