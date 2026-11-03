import type { CSSProperties, ReactNode } from "react";
import { AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { buildTimeline, countUp, formatInt, HEIGHT, WIDTH } from "../lib/motion";
import type { ReelPhoto, ReelScript } from "../schema";
import { BOTTOM, HUD_TOP, labelStyle, numberStyle, PROGRESS_TOP, type Theme, THEMES, TITLE_TOP, titleSize, W, X } from "./tokens";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

export const themeOf = (script: ReelScript): Theme => THEMES[script.design];
export const simulationBadge = (simulations: number): string => `MONTE CARLO · ${formatInt(simulations)} SİMÜLASYON`;

/** Rakamlar sabit genişlikte: sayaç dönerken genişlik oynamaz, alt alta rakamlar hizalanır. */
export function Figures({ theme, text }: { theme: Theme; text: string }) {
  if (theme.digitEm === null) return <>{text}</>;
  return <>{[...text].map((char, index) => (/d/u.test(char) ? <span key={index} style={{ display: "inline-block", width: `${theme.digitEm}em`, textAlign: "center" }}>{char}</span> : char))}</>;
}

export function useEnter(start: number, distance = 24): CSSProperties {
  const frame = useCurrentFrame();
  return {
    opacity: interpolate(frame, [start, start + 8], [0, 1], clamp),
    transform: `translateY(${interpolate(frame, [start, start + 14], [distance, 0], { ...clamp, easing: Easing.out(Easing.cubic) })}px)`,
  };
}

const GRAIN = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='320' height='320'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 .55 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`;

/** Yayın: sert açılı takım rengi bantları ve hız çizgileri. */
function BroadcastMotif({ home, away, accent }: { home: string; away: string; accent: string }) {
  return (
    <svg width={WIDTH} height={HEIGHT} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} style={{ position: "absolute", inset: 0 }}>
      {/* Bantlar yazı alanına girmez: sol üstte HUD'ın üstünde, sağ altta alt yazı bandında biter. */}
      <polygon points={`0,0 560,0 0,190`} fill={home} opacity={0.9} />
      <polygon points={`560,0 760,0 0,258 0,190`} fill={accent} opacity={0.95} />
      <polygon points={`${WIDTH},${HEIGHT} ${WIDTH - 620},${HEIGHT} ${WIDTH},${HEIGHT - 340}`} fill={away} opacity={0.9} />
      <polygon points={`${WIDTH - 620},${HEIGHT} ${WIDTH - 800},${HEIGHT} ${WIDTH},${HEIGHT - 400} ${WIDTH},${HEIGHT - 340}`} fill={accent} opacity={0.95} />
      {[0, 1, 2, 3, 4, 5].map((index) => <line key={index} x1={WIDTH + 40} y1={150 + index * 40} x2={WIDTH - 340 + index * 34} y2={650 + index * 40} stroke="#FFFFFF" strokeOpacity={0.05} strokeWidth={6} />)}
    </svg>
  );
}

/** Veri laboratuvarı: ince ızgara, hedef işaretleri, tarama çizgisi. */
function LabMotif({ accent }: { accent: string }) {
  const cell = 54;
  const marks = [[X - 26, HUD_TOP - 26], [X + W + 26, HUD_TOP - 26], [X - 26, BOTTOM + 26], [X + W + 26, BOTTOM + 26]] as const;
  return (
    <svg width={WIDTH} height={HEIGHT} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} style={{ position: "absolute", inset: 0 }}>
      <defs>
        <pattern id="lab-grid" width={cell} height={cell} patternUnits="userSpaceOnUse"><path d={`M ${cell} 0 L 0 0 0 ${cell}`} fill="none" stroke={accent} strokeOpacity={0.13} strokeWidth={1.2} /></pattern>
      </defs>
      <rect width={WIDTH} height={HEIGHT} fill="url(#lab-grid)" />
      {marks.map(([x, y], index) => <g key={index} stroke={accent} strokeWidth={2.5} strokeOpacity={0.85}><line x1={x - 16} y1={y} x2={x + 16} y2={y} /><line x1={x} y1={y - 16} x2={x} y2={y + 16} /></g>)}
    </svg>
  );
}

/**
 * Zemin: bulanık stadyum/kalabalık, üstünde bulanık oyuncu, koyu katman, takım rengi ışığı. Bütün 1080×1920'yi doldurur.
 * Metin arkası kontrastı render'dan ölçülür (`scripts/style-board.ts`).
 */
export function StageBackdrop({ script }: { script: ReelScript }) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const theme = themeOf(script);
  const home = script.meta.teams.home.colors.primary;
  const away = script.meta.teams.away.colors.primary;
  const push = interpolate(frame, [0, durationInFrames], [1.02, 1.08], clamp);
  const photo = script.photos["home-1"];
  const dim = { A: "rgba(4,6,10,0.66)", B: "rgba(10,8,5,0.7)", C: "rgba(2,9,11,0.82)" }[theme.id];
  return (
    <AbsoluteFill style={{ backgroundColor: "#05070A", overflow: "hidden" }}>
      <Img src={staticFile(theme.stage)} style={{ position: "absolute", inset: 0, width: WIDTH, height: HEIGHT, objectFit: "cover", transform: `scale(${push})`, filter: theme.id === "C" ? "saturate(0.5) hue-rotate(90deg)" : undefined }} />
      {photo && theme.id !== "C" ? <Img src={staticFile(photo.src)} style={{ position: "absolute", left: -180, top: 420, width: 1440, height: 1440 / photo.aspect, objectFit: "cover", filter: "blur(46px) saturate(1.2)", opacity: 0.42 }} /> : null}
      <AbsoluteFill style={{ background: dim }} />
      <AbsoluteFill style={{ background: [
        `radial-gradient(ellipse 85% 34% at 0% 26%, ${home}66 0%, transparent 100%)`,
        `radial-gradient(ellipse 85% 34% at 100% 76%, ${away}66 0%, transparent 100%)`,
      ].join(", ") }} />
      {theme.id === "A" ? <BroadcastMotif home={home} away={away} accent={theme.accent} /> : null}
      {theme.id === "C" ? <LabMotif accent={theme.accent} /> : null}
      {theme.id === "B" ? <AbsoluteFill style={{ background: "radial-gradient(ellipse 90% 70% at 50% 42%, transparent 40%, rgba(0,0,0,0.62) 100%)" }} /> : null}
      <AbsoluteFill style={{ backgroundImage: GRAIN, opacity: theme.id === "B" ? 0.11 : 0.06 }} />
    </AbsoluteFill>
  );
}

/** HUD: logo + simülasyon rozeti (N veriden; sürüm/saat yok) + sahne sahne ilerleme. */
export function StageHud({ script }: { script: ReelScript }) {
  const frame = useCurrentFrame();
  const theme = themeOf(script);
  const { entries } = buildTimeline(script.scenes.map((scene) => scene.durationInFrames));
  const badge = simulationBadge(script.meta.snapshot.simulations);
  const badgeStyle: CSSProperties = theme.id === "A"
    ? { fontFamily: theme.label, fontWeight: 900, fontSize: 34, lineHeight: 1, color: theme.accentInk, background: theme.accent, padding: "9px 18px 8px", transform: "skewX(-10deg)" }
    : theme.id === "B"
      ? { fontFamily: theme.label, fontWeight: 700, fontSize: 26, letterSpacing: 0.6, lineHeight: 1, color: theme.ink }
      : { fontFamily: theme.label, fontWeight: 700, fontSize: 26, letterSpacing: -0.4, lineHeight: 1, color: theme.accent, textShadow: `0 0 18px ${theme.accent}99` };
  return (
    <>
      <div style={{ position: "absolute", left: X, width: W, top: HUD_TOP, height: 50, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Img src={staticFile(script.brand.logo)} style={{ height: 40, width: "auto" }} />
        <div data-hud-badge="" style={{ display: "flex", alignItems: "center", gap: 10, whiteSpace: "nowrap", marginRight: theme.id === "A" ? 8 : 0 }}>
          {theme.id === "C" ? <span style={{ width: 12, height: 12, borderRadius: 6, background: theme.accent, boxShadow: `0 0 16px ${theme.accent}` }} /> : null}
          <span style={badgeStyle}><span style={theme.id === "A" ? { display: "inline-block", transform: "skewX(10deg)" } : undefined}>{badge}</span></span>
        </div>
      </div>
      {theme.id === "B" ? <div style={{ position: "absolute", left: X, width: W, top: HUD_TOP + 56, height: 2, background: theme.panelEdge }} /> : null}
      <div style={{ position: "absolute", left: X, width: W, top: PROGRESS_TOP, height: 6, display: "flex", gap: 4 }}>
        {entries.map((entry, index) => (
          <div key={index} style={{ flex: 1, background: "rgba(255,255,255,0.3)", overflow: "hidden", transform: theme.id === "A" ? "skewX(-20deg)" : undefined, borderRadius: theme.id === "A" ? 0 : 3 }}>
            <div style={{ height: "100%", background: theme.accent, width: `${interpolate(frame, [entry.from, entry.from + entry.duration - 8], [0, 100], clamp)}%` }} />
          </div>
        ))}
      </div>
    </>
  );
}

/** Soru başlığı: 2 satır, 2. satır vurgu rengi. Büyük harf yalnız CSS ile; kök `lang="tr"` i→İ, ı→I çevirir. */
export function QuestionTitle({ theme, line1, line2, still = false, top = TITLE_TOP }: { theme: Theme; line1: string; line2: string; still?: boolean; top?: number }) {
  const size = titleSize(theme, line1, line2);
  const first = useEnter(4);
  const second = useEnter(13);
  const common: CSSProperties = { fontFamily: theme.display, fontWeight: theme.titleWeight, fontSize: size, lineHeight: theme.id === "A" ? 1.08 : 1.1, textTransform: theme.titleUpper ? "uppercase" : "none", whiteSpace: "nowrap", letterSpacing: theme.id === "C" ? -1.5 : 0 };
  return (
    <div data-title="" style={{ position: "absolute", left: X, width: W, top }}>
      <div style={{ ...common, color: theme.ink, ...(still ? {} : first) }}>{line1}</div>
      <div style={{ ...common, color: theme.accent, fontStyle: theme.displayItalic ? "italic" : "normal", textShadow: theme.id === "C" ? `0 0 26px ${theme.accent}80` : undefined, ...(still ? {} : second) }}>{line2}</div>
    </div>
  );
}

export const titleBottom = (theme: Theme, line1: string, line2: string): number => TITLE_TOP + Math.ceil(titleSize(theme, line1, line2) * (theme.id === "A" ? 1.08 : 1.1) * 2);

/** Veri laboratuvarı: yüzü işaretleyen hedef köşeleri. */
function Reticle({ color }: { color: string }) {
  const corner = (style: CSSProperties) => <div style={{ position: "absolute", width: 26, height: 26, borderColor: color, borderStyle: "solid", borderWidth: 0, ...style }} />;
  return (
    <>
      {corner({ left: -10, top: -10, borderLeftWidth: 3, borderTopWidth: 3 })}
      {corner({ right: -10, top: -10, borderRightWidth: 3, borderTopWidth: 3 })}
      {corner({ left: -10, bottom: -10, borderLeftWidth: 3, borderBottomWidth: 3 })}
      {corner({ right: -10, bottom: -10, borderRightWidth: 3, borderBottomWidth: 3 })}
    </>
  );
}

/** Net oyuncu kesimi: doğal renk, takım rengi kenar ışığı. Yüz kutusu `data-face` ile ölçüme girer. */
export function PlayerCut({ theme, photo, color, left, top, height, flip = false, fade = true, startFrame = 0 }: { theme?: Theme; photo: ReelPhoto; color: string; left: number; top: number; height: number; flip?: boolean; fade?: boolean; startFrame?: number }) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const width = height * photo.aspect;
  const lab = theme?.id === "C";
  const scale = interpolate(frame, [0, durationInFrames], [1, 1.03], clamp);
  const mask = "linear-gradient(#000 70%, transparent 100%)";
  const enter = interpolate(frame, [startFrame, startFrame + 12], [30, 0], { ...clamp, easing: Easing.out(Easing.cubic) });
  return (
    <div style={{ position: "absolute", left: left + enter * (flip ? 1 : -1), top, width, height, transform: `scale(${scale}) ${flip ? "scaleX(-1)" : ""}`, transformOrigin: "50% 40%", ...(fade ? { WebkitMaskImage: mask, maskImage: mask } : {}) }}>
      <Img src={staticFile(photo.src)} style={{ width: "100%", height: "100%", objectFit: "contain", filter: `${lab ? "grayscale(1) contrast(1.15) brightness(0.95) " : ""}drop-shadow(0 0 28px ${color}${lab ? "" : "AA"}) drop-shadow(0 18px 30px rgba(0,0,0,0.55))` }} />
      {photo.faces.map((face, index) => (
        <div key={index} data-face="" style={{ position: "absolute", left: `${face.x * 100}%`, top: `${face.y * 100}%`, width: `${face.width * 100}%`, height: `${face.height * 100}%` }}>
          {lab && theme ? <Reticle color={theme.accent} /> : null}
        </div>
      ))}
    </div>
  );
}

/** Büyük ana rakam (≥ 160 px). "%" işareti rakamın yarısı kadar: rakam öne çıkar. */
export function HeroFigure({ theme, value, percent, label, color, start = 18, size = theme.heroSize }: { theme: Theme; value: string; percent: number | null; label: string; color: string; start?: number; size?: number }) {
  const frame = useCurrentFrame();
  const shown = percent === null ? value.replace(/^%/, "") : String(countUp(frame, { to: percent, start, duration: 30 }));
  const isPercent = percent !== null;
  const glow = theme.id === "C" ? { textShadow: `0 0 44px ${theme.accent}88` } : {};
  return (
    <div data-block="ana rakam" style={{ display: "inline-flex", alignSelf: "flex-start", flexDirection: "column", alignItems: "flex-start", opacity: interpolate(frame, [start - 6, start + 2], [0, 1], clamp) }}>
      <div data-hero="" style={{ ...numberStyle(theme, size), color: theme.ink, display: "flex", alignItems: "flex-start", ...glow }}>
        {isPercent ? <span style={{ fontSize: Math.round(size * 0.55), marginTop: Math.round(size * 0.08), marginRight: 8, color: theme.accent }}>%</span> : null}
        <span><Figures theme={theme} text={shown} /></span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 8 }}>
        <span style={{ width: 28, height: 28, background: color, flexShrink: 0, borderRadius: theme.id === "A" ? 0 : theme.id === "C" ? 4 : 14, transform: theme.id === "A" ? "skewX(-14deg)" : undefined }} />
        <span style={{ ...labelStyle(theme, Math.max(34, theme.labelSize + 6)), color: theme.ink, whiteSpace: "nowrap", textTransform: theme.id === "A" ? "uppercase" : "none" }}>{label}</span>
      </div>
    </div>
  );
}

function SupportCell({ theme, value, label, color, index }: { theme: Theme; value: string; label: string; color: string; index: number }) {
  const enter = useEnter(40 + index * 7);
  const box: CSSProperties = theme.id === "A"
    ? { background: theme.panel, borderLeft: `10px solid ${color}`, padding: "12px 12px 12px 16px" }
    : theme.id === "B"
      ? { borderTop: `3px solid ${color}`, padding: "12px 0 0", background: "transparent" }
      : { background: theme.panel, border: `1.5px solid ${theme.panelEdge}`, borderRadius: 6, padding: "12px 14px", boxShadow: `inset 0 0 26px ${theme.accent}14` };
  return (
    <div data-block={`destek ${label}`} style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 6, ...box, ...enter }}>
      <div data-support="" style={{ ...numberStyle(theme, theme.supportSize), color: theme.ink, whiteSpace: "nowrap" }}><Figures theme={theme} text={value} /></div>
      <div style={{ ...labelStyle(theme), textTransform: theme.id === "A" ? "uppercase" : "none" }}>{label}</div>
    </div>
  );
}

/** 2–4 destek istatistiği (≥ 48 px). 4 değer iki satıra iner. */
export function SupportStrip({ theme, items, colors }: { theme: Theme; items: readonly { key: string; value: string; label: string; side: "home" | "away" | "draw" | null }[]; colors: { home: string; away: string } }) {
  const rowItems = items.length === 4 ? [items.slice(0, 2), items.slice(2)] : [items];
  const paint = (side: "home" | "away" | "draw" | null) => (side === "home" ? colors.home : side === "away" ? colors.away : side === "draw" ? "#A8B2AE" : theme.accent);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, width: W }}>
      {rowItems.map((row, rowIndex) => (
        <div key={rowIndex} style={{ display: "flex", gap: theme.id === "B" ? 26 : 12 }}>
          {row.map((item, index) => <SupportCell key={item.key} theme={theme} value={item.value} label={item.label} color={paint(item.side)} index={rowIndex * 2 + index} />)}
        </div>
      ))}
    </div>
  );
}

export function Panel({ theme, name, children, style }: { theme: Theme; name: string; children: ReactNode; style?: CSSProperties }) {
  const box: CSSProperties = theme.id === "A"
    ? { background: theme.panel, clipPath: "polygon(0 0, 100% 0, 100% calc(100% - 26px), calc(100% - 26px) 100%, 0 100%)" }
    : theme.id === "B"
      ? { background: theme.panel, borderTop: `2px solid ${theme.panelEdge}`, borderBottom: `2px solid ${theme.panelEdge}` }
      : { background: theme.panel, border: `1.5px solid ${theme.panelEdge}`, borderRadius: 6, boxShadow: `inset 0 0 40px ${theme.accent}12` };
  return <div data-block={name} style={{ width: W, padding: "18px 20px", ...box, ...style }}>{children}</div>;
}
