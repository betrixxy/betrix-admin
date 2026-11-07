import { Img, interpolate, staticFile } from "remotion";
import { seeded } from "../lib/motion";
import { PITCH, countTo } from "./camera";
import { CONTENT, GREEN, GREEN_TEXT, INK, PANEL, Percent, SAFE, SAFE_WIDTH, Tag, Title, labelFont, numberFont, upper } from "./parts";
import type { Beat, TacticalScript } from "./types";
import { num, optNum, text } from "./values";

/**
 * Gol beat'leri. "Kaç gol olur?": kamera kaleye iner, toplar kaleye düşer; iki tamamlayıcı çubuk (%80 / %20, toplam 100).
 * "İki takım da gol atar mı?": iki kale aynı anda yanar; ikinci cümlede ilk golü atma ihtimali + kaleye ok.
 * Saha üstünde marka yeşili yok: toplar beyaz, ışıklar beyaz/takım rengi.
 */

/** Toplar orta sahadan üst kaleye (ev sahibinin hücum yönü) süzülür; pay kadar top girer, kalanı aşağı düşer. */
export function GoalsBoard({ beat, local }: { beat: Beat; local: number }) {
  const total = 10;
  const inside = Math.round((num(beat, "over") / 100) * total);
  const { width: w, height: h } = PITCH;
  return (
    <svg width={w} height={h} style={{ position: "absolute", inset: 0 }}>
      <rect x={w * 0.36} y={0} width={w * 0.28} height={h * 0.055} fill="rgba(255,255,255,0.08)" opacity={interpolate(local, [6, 20], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })} />
      {Array.from({ length: total }, (_, index) => {
        const start = 8 + index * 5;
        const t = interpolate(local, [start, start + 22], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        const scores = index < inside;
        const fromX = w * (0.25 + seeded(index * 3 + 1) * 0.5);
        const fromY = h * (0.38 + seeded(index * 3 + 2) * 0.1);
        const toX = scores ? w * (0.42 + seeded(index * 3 + 3) * 0.16) : w * (seeded(index * 3 + 3) > 0.5 ? 0.72 : 0.22);
        const toY = scores ? h * 0.02 : h * 0.07;
        const ease = 1 - (1 - t) ** 2;
        const x = fromX + (toX - fromX) * ease;
        const y = fromY + (toY - fromY) * ease - Math.sin(Math.PI * t) * 80;
        const opacity = t <= 0 ? 0 : scores ? 0.95 : 0.95 - t * 0.6;
        return <circle key={index} cx={x} cy={y} r={14} fill={scores ? "#FFFFFF" : "rgba(255,255,255,0.55)"} stroke="rgba(0,0,0,0.5)" strokeWidth={3} opacity={opacity} />;
      })}
    </svg>
  );
}

function Bar({ value, label, local, strong }: { value: number; label: string; local: number; strong: boolean }) {
  const grow = interpolate(local, [4, 20], [0, value / 100], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const glow = strong ? 0.35 + 0.25 * Math.sin(local / 5) : 0;
  return (
    <div style={{ width: SAFE_WIDTH, boxSizing: "border-box", background: PANEL, borderRadius: 14, padding: strong ? "16px 26px 18px" : "12px 26px 14px", boxShadow: strong ? `0 0 ${24 + glow * 30}px rgba(76,196,86,${glow})` : undefined }}>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 22 }}>
        <Percent value={countTo(value, local)} size={strong ? 190 : 120} color={strong ? INK : "rgba(246,248,244,0.82)"} />
        <span style={{ ...labelFont, fontSize: strong ? 50 : 40, color: INK, marginBottom: strong ? 22 : 12 }}>{upper(label)}</span>
      </div>
      <div style={{ marginTop: 10, height: strong ? 26 : 18, borderRadius: 13, background: "rgba(255,255,255,0.12)", overflow: "hidden" }}>
        <div style={{ width: `${grow * 100}%`, height: "100%", borderRadius: 13, background: strong ? GREEN : "rgba(246,248,244,0.55)" }} />
      </div>
    </div>
  );
}

export function GoalsOverlay({ beat, local }: { beat: Beat; local: number }) {
  return (
    <div style={{ position: "absolute", left: SAFE.left, width: SAFE_WIDTH, top: CONTENT.top, display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
      <Tag>{beat.tag}</Tag>
      <Title>{upper(beat.title)}</Title>
      <div style={{ marginTop: 22, display: "flex", flexDirection: "column", gap: 16 }}>
        <Bar value={num(beat, "over")} label={text(beat, "overLabel")} local={local} strong />
        <Bar value={num(beat, "under")} label={text(beat, "underLabel")} local={local - 4} strong={false} />
      </div>
    </div>
  );
}

/** İki kale aynı anda yanar; ikinci cümlede ev sahibi rengiyle orta sahadan ilk golün kalesine ok. */
export function BothBoard({ script, beat, local }: { script: TacticalScript; beat: Beat; local: number }) {
  const { width: w, height: h } = PITCH;
  const pulse = interpolate(local, [4, 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) * (0.75 + 0.25 * Math.sin(local / 4));
  const second = optNum(beat, "sentence2At", beat.duration);
  const arrow = interpolate(local, [second, second + 16], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const homeFirst = num(beat, "firstHome") >= num(beat, "firstAway");
  const color = homeFirst ? script.home.primary : script.away.primary;
  const goalY = homeFirst ? 30 : h - 30;
  const length = Math.abs(goalY - h / 2);
  return (
    <svg width={w} height={h} style={{ position: "absolute", inset: 0 }}>
      <defs>
        <radialGradient id="goal-light"><stop offset="0%" stopColor="rgba(255,255,255,0.85)" /><stop offset="100%" stopColor="rgba(255,255,255,0)" /></radialGradient>
      </defs>
      {[0, h].map((y) => <ellipse key={y} cx={w / 2} cy={y} rx={w * 0.26} ry={h * 0.07} fill="url(#goal-light)" opacity={pulse} />)}
      <line x1={w / 2} y1={h / 2} x2={w / 2} y2={h / 2 + (goalY - h / 2) * arrow} stroke={color} strokeWidth={16} strokeLinecap="round" opacity={arrow > 0 ? 0.95 : 0} strokeDasharray={`${length}`} />
      {arrow > 0.95 ? <path d={homeFirst ? `M${w / 2 - 34} ${goalY + 44} L${w / 2} ${goalY} L${w / 2 + 34} ${goalY + 44}` : `M${w / 2 - 34} ${goalY - 44} L${w / 2} ${goalY} L${w / 2 + 34} ${goalY - 44}`} stroke={color} strokeWidth={16} fill="none" strokeLinecap="round" strokeLinejoin="round" /> : null}
    </svg>
  );
}

export function BothOverlay({ script, beat, local }: { script: TacticalScript; beat: Beat; local: number }) {
  const second = optNum(beat, "sentence2At", 0);
  const firstIn = interpolate(local, [second, second + 6], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const items = [
    { label: upper(script.home.short), value: num(beat, "firstHome"), logo: script.home.logo as string | null },
    { label: upper(script.away.short), value: num(beat, "firstAway"), logo: script.away.logo as string | null },
    { label: "GOL YOK", value: num(beat, "firstNone"), logo: null },
  ];
  return (
    <div style={{ position: "absolute", left: SAFE.left, width: SAFE_WIDTH, top: CONTENT.top, display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
      <Tag>{beat.tag}</Tag>
      <Title>{upper(beat.title)}</Title>
      <div style={{ marginTop: 20, width: SAFE_WIDTH, boxSizing: "border-box", background: PANEL, borderRadius: 14, borderLeft: `10px solid ${GREEN}`, padding: "14px 26px 14px", display: "flex", alignItems: "center", gap: 24 }}>
        <Percent value={countTo(num(beat, "both"), local)} size={200} />
        <span style={{ ...labelFont, fontSize: 44, color: INK, lineHeight: 1.1 }}>{upper(text(beat, "bothLabel"))}</span>
      </div>
      <div style={{ marginTop: 16, width: SAFE_WIDTH, boxSizing: "border-box", background: PANEL, borderRadius: 14, padding: "14px 22px 14px", opacity: firstIn, transform: `translateY(${(1 - firstIn) * 24}px)` }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ ...labelFont, fontSize: 38, color: INK }}>{upper(text(beat, "firstLabel"))}</span>
          <span style={{ ...numberFont, fontSize: 40, color: GREEN_TEXT, border: `3px solid ${GREEN_TEXT}`, borderRadius: 8, padding: "2px 10px 0" }}>0&apos;</span>
        </div>
        <div style={{ marginTop: 12, display: "flex", gap: 14 }}>
          {items.map((item) => (
            <div key={item.label} style={{ flex: item.logo ? 1.2 : 0.9, display: "flex", alignItems: "center", gap: 10 }}>
              {item.logo ? <Img src={staticFile(item.logo)} style={{ width: 64, height: 64, objectFit: "contain" }} /> : null}
              <div style={{ display: "flex", flexDirection: "column" }}>
                <Percent value={countTo(item.value, local - second)} size={item.logo ? 104 : 80} color={item.logo ? INK : "rgba(246,248,244,0.8)"} />
                <span style={{ ...labelFont, fontSize: 34, color: INK }}>{item.label}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
