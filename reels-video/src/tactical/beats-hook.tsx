import { AbsoluteFill, Easing, Img, interpolate, staticFile } from "remotion";
import { countTo, INTRO } from "./camera";
import { BAND, CONTENT, GLASS, GREEN_TEXT, INK, SAFE, box, labelFont, numberFont, reveal, upper } from "./parts";
import type { Beat, TacticalScript } from "./types";
import { num, optNum, text } from "./values";

/**
 * Giriş + kanca (kullanıcı 2026-11-07, düzeltme 2). 0. kare boş değil: logolar ekranın iki yanında, kanca metni ortada.
 *   0–1,2 sn  net stadyum fotoğrafı, hızlı push-in (%100 → %115); logolar iki yandan gelir, `INTRO.collide` karesinde ortadaki "VS"
 *             ile çarpışır (ease-out + 3 kare sarsıntı; ses izinde aynı karede bas "thump"). Dev kanca: "GALATASARAY %75 FAVORİ" /
 *             "AMA İLK GOLDE SÜRPRİZ VAR" (rakam sayar, "SÜRPRİZ" marka yeşili).
 *   1,2–2,8 sn fotoğraf söner, kamera tahtaya iner, logolar küçülüp banda dönüşür, kanca paneli içerik alanının üstüne yerleşir.
 *   sonra     "Yüz bin kez oynattık" anında simülasyon paneli açılır (sesin üçüncü cümlesi).
 */

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const easeOut = Easing.out(Easing.cubic);
const ease = Easing.bezier(0.65, 0, 0.35, 1);
const SHAKE = [9, -7, 4];
const LOGO = { size: 250, top: 520, home: 300, away: 780 } as const;
/** Kanca satırı ekranın ~%85'i. */
const HOOK_WIDTH = 918;
const fitSize = (line: string, width: number, max: number) => Math.min(max, Math.floor(width / Math.max(1, line.length * 0.47)));

export function HookOverlay({ script, beat, local }: { script: TacticalScript; beat: Beat; local: number }) {
  const settle = interpolate(local, [INTRO.settleStart, INTRO.settleEnd], [0, 1], { ...clamp, easing: ease });
  const photo = interpolate(local, [INTRO.settleStart, INTRO.settleStart + 30], [1, 0], clamp);
  const push = interpolate(local, [0, INTRO.settleStart], [1, 1.15], { ...clamp, easing: easeOut });
  const fly = interpolate(local, [0, INTRO.collide], [0, 1], { ...clamp, easing: easeOut });
  const shakeAt = local - INTRO.collide;
  const shake = shakeAt >= 0 && shakeAt < SHAKE.length ? SHAKE[shakeAt] ?? 0 : 0;
  const vs = interpolate(local, [INTRO.collide, INTRO.collide + 6], [1.7, 1], { ...clamp, easing: easeOut });
  // Logolar: iki yandan merkeze; inişte banda doğru küçülüp söner (bant aynı anda açılır).
  const toBand = (x: number) => x + (SAFE.left + 36 - x) * settle;
  const logoSize = LOGO.size + (44 - LOGO.size) * settle;
  const logoTop = LOGO.top + (BAND.top + 8 - LOGO.top) * settle;
  const logosOut = interpolate(local, [INTRO.settleEnd - 12, INTRO.settleEnd], [1, 0], clamp);
  const homeX = toBand(60 + (LOGO.home - 60) * fly);
  const awayX = toBand(1020 + (LOGO.away - 1020) * fly) + 100 * settle;
  const fav = text(beat, "hookFavourite");
  const line1 = `${upper(fav)} %${num(beat, "hero")} FAVORİ`;
  const line2 = upper(text(beat, "hookLine2"));
  const accent = upper(text(beat, "hookAccent"));
  const scale = 1 - 0.38 * settle;
  const size1 = fitSize(line1, HOOK_WIDTH - 60, 120) * scale;
  const size2 = fitSize(line2, HOOK_WIDTH - 60, 120) * scale;
  const hookTop = 880 + (CONTENT.top - 880) * settle;
  const [before, after] = line2.split(accent);
  // Simülasyon paneli "Yüz bin" anında, ama iniş bitmeden asla (kanca paneli henüz yukarı çıkmamış olur).
  const simsAt = Math.max(INTRO.settleEnd, optNum(beat, "sentence2At", beat.duration));
  const simsIn = interpolate(local, [simsAt, simsAt + 6], [0, 1], clamp);
  return (
    <AbsoluteFill>
      {photo > 0 ? (
        <AbsoluteFill style={{ opacity: photo, overflow: "hidden" }}>
          <Img src={staticFile(script.backdropSharp ?? script.backdrop ?? "brand/checkmatch-mark.png")} style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${push})` }} />
          <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(3,8,5,0.55) 0%, rgba(3,8,5,0.35) 35%, rgba(3,8,5,0.6) 100%)" }} />
        </AbsoluteFill>
      ) : null}
      <AbsoluteFill style={{ transform: `translate(${shake}px, ${-shake / 2}px)` }}>
        {logosOut > 0 ? (
          <>
            <Img src={staticFile(script.home.logo)} style={{ position: "absolute", left: homeX - logoSize / 2, top: logoTop, width: logoSize, height: logoSize, objectFit: "contain", opacity: logosOut, filter: "drop-shadow(0 10px 24px rgba(0,0,0,0.6))" }} />
            <Img src={staticFile(script.away.logo)} style={{ position: "absolute", left: awayX - logoSize / 2, top: logoTop, width: logoSize, height: logoSize, objectFit: "contain", opacity: logosOut, filter: "drop-shadow(0 10px 24px rgba(0,0,0,0.6))" }} />
          </>
        ) : null}
        {local >= INTRO.collide && settle < 1 ? (
          <div style={{ position: "absolute", left: 540 - 60, width: 120, top: LOGO.top + LOGO.size / 2 - 50, textAlign: "center", ...labelFont, fontSize: 88, color: GREEN_TEXT, transform: `scale(${vs})`, opacity: 1 - settle, textShadow: "0 4px 18px rgba(0,0,0,0.8)" }}>VS</div>
        ) : null}
        <div {...box("kanca")} style={{ position: "absolute", left: SAFE.left + (1 - settle) * (540 - HOOK_WIDTH / 2 - SAFE.left), top: hookTop, width: HOOK_WIDTH - (HOOK_WIDTH - 790) * settle, boxSizing: "border-box", ...GLASS, borderRadius: 16, padding: `${18 * scale}px 30px ${16 * scale}px`, display: "flex", flexDirection: "column", alignItems: "center", gap: 10 * scale }}>
          <div style={{ ...numberFont, fontSize: size1, color: INK, whiteSpace: "nowrap" }}>
            {upper(fav)} %{countTo(num(beat, "hero"), local, 12)} FAVORİ
          </div>
          <div style={{ ...labelFont, fontSize: size2, color: INK, whiteSpace: "nowrap" }}>
            {before}<span style={{ color: GREEN_TEXT }}>{accent}</span>{after}
          </div>
        </div>
      </AbsoluteFill>
      <div {...box("simülasyon-paneli")} style={{ position: "absolute", left: 540 - 330, width: 660, top: 860, boxSizing: "border-box", ...GLASS, borderRadius: 14, padding: "16px 30px 12px", display: "flex", flexDirection: "column", alignItems: "center", ...reveal(simsIn) }}>
        <span style={{ ...numberFont, fontSize: 170, color: INK }}>{countTo(script.simulations, local - simsAt, 12).toLocaleString("tr-TR")}</span>
        <span style={{ ...labelFont, fontSize: 56, color: GREEN_TEXT, marginTop: 4 }}>{upper(text(beat, "countLabel"))}</span>
      </div>
    </AbsoluteFill>
  );
}

/** Monte Carlo top yolları yalnız tahta göründükten sonra. */
export const hookBoardOpacity = (local: number) => interpolate(local, [INTRO.settleStart + 12, INTRO.settleEnd], [0, 1], clamp);
