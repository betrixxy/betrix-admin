import { useEffect, type CSSProperties, type ReactNode } from "react";
import { AbsoluteFill, continueRender, delayRender, Easing, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { cropFor, focusOrigin, placeCrop } from "../lib/crop";
import { AUDIT_PREFIX, measureDom } from "../lib/dom-audit";
import { buildTimeline, CONTENT_WIDTH, LINE2_DELAY_FRAMES, SAFE, spokenThousands, TYPE, ZONES } from "../lib/motion";
import type { PhotoSlot } from "../lib/photo-layouts";
import type { ReelPhoto, ReelScript } from "../schema";

export const FONT_FAMILY = "Geist";
export const COLORS = { ground: "#0A0F0C", surface: "#131A16", border: "rgba(255,255,255,0.13)", ink: "#FFFFFF", ink2: "#C4CEC8", ink3: "#93A099", draw: "#8E9A94", track: "rgba(255,255,255,0.12)" } as const;
export const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
export const tabular = { fontVariantNumeric: "tabular-nums" } as const;

const NOISE = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='320' height='320'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 .55 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`;

/** Zemin hep marka koyusu + yeşil. Takım rengi burada yoktur. */
export function Backdrop({ accent }: { accent: string }) {
  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.ground }}>
      <AbsoluteFill style={{ background: `radial-gradient(ellipse 78% 44% at 50% 46%, ${accent}24 0%, ${accent}0D 50%, transparent 78%)` }} />
      <AbsoluteFill style={{ backgroundImage: NOISE, opacity: 0.06 }} />
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
      <div style={{ position: "absolute", left: SAFE.left, width: CONTENT_WIDTH, top: ZONES.hudTop, height: 44, display: "flex", alignItems: "center", justifyContent: "space-between", fontFamily: FONT_FAMILY }}>
        <Img src={staticFile(script.brand.logo)} style={{ height: 44, width: "auto" }} />
        <div style={{ color: COLORS.ink2, fontSize: 30, fontWeight: 700, whiteSpace: "nowrap", ...tabular }}>{home.shortName} – {away.shortName} · {script.meta.match.kickoffLabel}</div>
      </div>
      <div style={{ position: "absolute", left: SAFE.left, width: CONTENT_WIDTH, top: ZONES.progressTop, height: 6, display: "flex", gap: 4 }}>
        {entries.map((entry, index) => (
          <div key={index} style={{ flex: 1, background: COLORS.track, borderRadius: 3, overflow: "hidden" }}>
            <div style={{ height: "100%", background: script.brand.accent, width: `${interpolate(frame, [entry.from, entry.from + entry.duration - 8], [0, 100], clamp)}%` }} />
          </div>
        ))}
      </div>
    </>
  );
}

const fitSize = (text: string): number => Math.min(TYPE.title, Math.floor(860 / (text.length * 0.56)));

export function useReveal(start: number, distance = 22): CSSProperties {
  const frame = useCurrentFrame();
  return {
    opacity: interpolate(frame, [start, start + 8], [0, 1], clamp),
    transform: `translateY(${interpolate(frame, [start, start + 12], [distance, 0], { ...clamp, easing: Easing.out(Easing.cubic) })}px)`,
  };
}

/** Başlık: 1. satır beyaz, 2. satır yeşil ve ~300 ms sonra. `still`: kapakta ilk kare tam dolu olsun diye hareketsiz. */
export function Title({ line1, line2, accent, start = 6, still = false }: { line1: string; line2: string; accent: string; start?: number; still?: boolean }) {
  const size = Math.min(fitSize(line1), fitSize(line2));
  const first = useReveal(start);
  const second = useReveal(start + LINE2_DELAY_FRAMES);
  return (
    <div style={{ position: "absolute", left: SAFE.left, width: CONTENT_WIDTH, top: ZONES.titleTop, fontFamily: FONT_FAMILY, fontWeight: 900, fontSize: size, lineHeight: 1.04, letterSpacing: -2 }}>
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
  return <div style={{ position: "absolute", left: SAFE.left, width: CONTENT_WIDTH, top, height, display: "flex", flexDirection: "column", fontFamily: FONT_FAMILY, color: COLORS.ink, transform: `scale(${push})`, ...style }}>{children}</div>;
}

export function Strip({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <div style={{ position: "absolute", left: SAFE.left, width: CONTENT_WIDTH, top: ZONES.stripTop, height: ZONES.stripHeight, display: "flex", gap: 14, fontFamily: FONT_FAMILY, color: COLORS.ink, ...style }}>{children}</div>;
}

/** Her veri sahnesinin altındaki güvenilirlik satırı. */
export function TrustLine({ script }: { script: ReelScript }) {
  const { modelVersion, simulations, computedLabel } = script.meta.snapshot;
  return (
    <div style={{ position: "absolute", left: SAFE.left, width: CONTENT_WIDTH, top: ZONES.trustTop, fontFamily: FONT_FAMILY, fontSize: TYPE.note, fontWeight: 500, letterSpacing: -0.5, color: COLORS.ink3, whiteSpace: "nowrap", ...tabular }}>
      checkmatch modeli v{modelVersion} · {spokenThousands(simulations)} simülasyon · hesap {computedLabel}
    </div>
  );
}

/** Düz koyu yüzey, ince kenarlık, 24 px köşe. */
export function Card({ name, children, style, edge }: { name: string; children: ReactNode; style?: CSSProperties; edge?: string }) {
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

const MASK = "linear-gradient(#000 70%, transparent 100%)";

/**
 * Şeffaf kesim: takım rengiyle duotone, zemine eriyen alt kenar, yavaş zoom ve parallax. Tonlama render anındadır,
 * arşiv nötr kalır. Yüz kutuları metadata'dan gelir ve `data-face` ile ölçüme girer.
 */
export function Cutout({ photo, color, slot, drift = 0, opacity = 1 }: { photo: ReelPhoto; color: string; slot: PhotoSlot; drift?: number; opacity?: number }) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const progress = frame / Math.max(1, durationInFrames);
  const place = placeCrop(cropFor(photo, slot.frame), photo.aspect, slot.frame);
  const origin = focusOrigin(photo, slot.frame);
  const src = staticFile(photo.src);
  const silhouette: CSSProperties = { position: "absolute", inset: 0, WebkitMaskImage: `url("${src}")`, WebkitMaskSize: "100% 100%", maskImage: `url("${src}")`, maskSize: "100% 100%" };
  return (
    <div style={{ position: "absolute", left: slot.left, top: slot.top, width: slot.frame.width, height: slot.frame.height, overflow: "hidden", opacity, transform: `translateX(${drift * progress}px) scale(${1 + 0.035 * progress}) ${slot.flip ? "scaleX(-1)" : ""}`, transformOrigin: `${origin.x}% ${origin.y}%`, WebkitMaskImage: MASK, maskImage: MASK }}>
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

/** Render denetimi: kare çizildikten sonra gerçek kutuları konsola yazar. Yalnız tek kare denetiminde açılır. */
export function AuditProbe() {
  const frame = useCurrentFrame();
  useEffect(() => {
    const handle = delayRender("yerleşim denetimi");
    void document.fonts.ready.then(() => {
      const root = document.querySelector("[data-reel-root]");
      if (root) console.log(AUDIT_PREFIX + JSON.stringify({ frame, audit: measureDom(root) }));
      continueRender(handle);
    });
  }, [frame]);
  return null;
}
