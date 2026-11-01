import type { CSSProperties, ReactNode } from "react";
import { AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { cropFor, focusOrigin, placeCrop, type Frame } from "../lib/crop";
import { HEIGHT, LINE2_DELAY_FRAMES, SAFE, WIDTH } from "../lib/motion";
import type { ReelPhoto } from "../schema";

export const FONT_FAMILY = "Geist";

const NOISE = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='320' height='320'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 .55 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`;

/** Bütün videonun zemini: koyu, ortada hafif parlama, ince kum. Geçişlerde siyah kare çıkmaz. */
export function Backdrop({ accent }: { accent: string }) {
  return (
    <AbsoluteFill style={{ backgroundColor: "#090D0B" }}>
      <AbsoluteFill style={{ background: `radial-gradient(ellipse 72% 46% at 50% 44%, ${accent}2E 0%, ${accent}12 45%, transparent 75%)` }} />
      <AbsoluteFill style={{ backgroundImage: NOISE, opacity: 0.07 }} />
    </AbsoluteFill>
  );
}

/** Sol üst imza: tüm video boyunca aynı yerde. */
export function Signature({ logo }: { logo: string }) {
  return <Img src={staticFile(logo)} style={{ position: "absolute", left: SAFE.left, top: SAFE.top + 12, height: 44, width: "auto" }} />;
}

/** İçerik alanı: Instagram güvenli alanının içi. */
export function SafeArea({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div style={{ position: "absolute", left: SAFE.left, right: SAFE.right, top: SAFE.top, bottom: SAFE.bottom, display: "flex", flexDirection: "column", fontFamily: FONT_FAMILY, ...style }}>
      {children}
    </div>
  );
}

/** 876 px içerik genişliğine sığacak başlık boyutu: Geist Black ortalama harf genişliğine göre. */
const headlineSize = (text: string, base: number): number => Math.min(base, Math.floor(860 / (text.length * 0.56)));

/** Başlık kalıbı: 1. satır beyaz, 2. satır vurgu rengi ve ~300 ms gecikmeli. */
export function Headline({ line1, line2, accent }: { line1: string; line2: string; accent: string }) {
  const frame = useCurrentFrame();
  const size = Math.min(headlineSize(line1, 104), headlineSize(line2, 104));
  const appear = (delay: number) => ({
    opacity: interpolate(frame, [delay, delay + 8], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
    transform: `translateY(${interpolate(frame, [delay, delay + 12], [26, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) })}px)`,
  });
  return (
    <div style={{ marginTop: 90, fontWeight: 900, fontSize: size, lineHeight: 1.04, letterSpacing: -2 }}>
      <div style={{ color: "#FFFFFF", ...appear(4) }}>{line1}</div>
      <div style={{ color: accent, ...appear(4 + LINE2_DELAY_FRAMES) }}>{line2}</div>
    </div>
  );
}

/** Alt yazı: alt güvenli alanın hemen üstünde. */
export function Caption({ text }: { text: string }) {
  const frame = useCurrentFrame();
  return (
    <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, color: "#C9D2CD", fontSize: 38, fontWeight: 500, lineHeight: 1.25, opacity: interpolate(frame, [24, 34], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }}>
      {text}
    </div>
  );
}

export function Crest({ src, size }: { src: string; size: number }) {
  return <Img src={staticFile(src)} style={{ width: size, height: size, objectFit: "contain" }} />;
}

/**
 * Şeffaf kesim: takım rengiyle duotone, yavaş zoom ve parallax. Tonlama render anındadır, arşiv nötr kalır.
 * Kırpma ve zoom merkezi fotoğrafın metadata'sından gelir.
 */
export function Cutout({ photo, color, frame, left, bottom, flip = false, opacity = 1, drift = 0 }: {
  photo: ReelPhoto;
  color: string;
  frame: Frame;
  left: number;
  bottom: number;
  flip?: boolean;
  opacity?: number;
  /** Parallax yönü ve miktarı (px). */
  drift?: number;
}) {
  const current = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const progress = current / Math.max(1, durationInFrames);
  const place = placeCrop(cropFor(photo, frame), photo.aspect, frame);
  const origin = focusOrigin(photo, frame);
  const src = staticFile(photo.src);
  return (
    <div style={{
      position: "absolute", left, top: HEIGHT - bottom - frame.height, width: frame.width, height: frame.height, overflow: "hidden", opacity,
      // Alt kenar düz kesilmez, zemine erir.
      WebkitMaskImage: "linear-gradient(#000 72%, transparent 100%)", maskImage: "linear-gradient(#000 72%, transparent 100%)",
      transform: `translateX(${drift * progress}px) scale(${1 + 0.05 * progress}) ${flip ? "scaleX(-1)" : ""}`, transformOrigin: `${origin.x}% ${origin.y}%`,
    }}>
      <div style={{ position: "absolute", ...place, isolation: "isolate" }}>
        <Img src={src} style={{ width: "100%", height: "100%", filter: "grayscale(1) contrast(1.15)" }} />
        <div style={{
          position: "absolute", inset: 0, mixBlendMode: "color", background: color,
          WebkitMaskImage: `url("${src}")`, WebkitMaskSize: "100% 100%", maskImage: `url("${src}")`, maskSize: "100% 100%",
        }} />
        <div style={{
          position: "absolute", inset: 0, mixBlendMode: "soft-light", background: `linear-gradient(170deg, #FFFFFF, ${color} 55%, #000000)`,
          WebkitMaskImage: `url("${src}")`, WebkitMaskSize: "100% 100%", maskImage: `url("${src}")`, maskSize: "100% 100%",
        }} />
      </div>
    </div>
  );
}

export { WIDTH };
