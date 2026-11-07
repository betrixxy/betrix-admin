import { AbsoluteFill, Img, interpolate, staticFile } from "remotion";
import { Column, GREEN, GREEN_TEXT, Header, INK, GLASS, bodyFont, box, labelFont, reveal, upper, upperKeepSite } from "./parts";
import type { Beat, TacticalScript } from "./types";
import { num, text } from "./values";

/**
 * Kapanış: saha kararır (oyuncu noktaları söner, `TacticalReel`), MAÇ SONU KONTROL LİSTESİ kutuları sırayla tiklenir (tık sesi aynı
 * karelerde, `timeline.ts`), 3 bulanık kilitli satır + "+20 ihtimal daha → www.checkmatch.net"; ses bitince büyük logo, ✓ kendini
 * 0,6 sn'de çizer, bekleme ≤ 1 sn. Kilitli satırlarda gerçek veri yok: yalnız bulanık yer tutucu çubuk. Instagram adı yok.
 */

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
/** ✓ yolu (24 birimlik kutu). */
const CHECK = "M5 12.5 L10 17.5 L19 7";
const CHECK_LENGTH = 22;

function Check({ progress, size }: { progress: number; size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: "block" }}>
      <path d={CHECK} fill="none" stroke={GREEN_TEXT} strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={CHECK_LENGTH} strokeDashoffset={CHECK_LENGTH * (1 - progress)} />
    </svg>
  );
}

function Lock() {
  return (
    <svg width={40} height={40} viewBox="0 0 24 24"><rect x={5} y={11} width={14} height={10} rx={2} fill="rgba(246,248,244,0.75)" /><path d="M8 11 V8 a4 4 0 0 1 8 0 V11" fill="none" stroke="rgba(246,248,244,0.75)" strokeWidth={2.4} /></svg>
  );
}

/** Saha kararır (kontrol listesi okunur, logo sahnesi tam koyu). */
export function CloseDim({ beat, local }: { beat: Beat; local: number }) {
  const logoAt = num(beat, "logoAt");
  const dim = interpolate(local, [0, 10], [0, 0.68], clamp) + interpolate(local, [logoAt - 4, logoAt + 4], [0, 0.27], clamp);
  return <AbsoluteFill style={{ background: "#020604", opacity: dim }} />;
}

export function CloseOverlay({ script, beat, local }: { script: TacticalScript; beat: Beat; local: number }) {
  const logoAt = num(beat, "logoAt");
  // Liste ile logo hiçbir karede birlikte görünmez: liste 3 karede kapanır, logo ondan sonra açılır.
  const listOut = interpolate(local, [logoAt - 3, logoAt], [1, 0], clamp);
  const items = ["c1", "c2", "c3", "c4"].map((key, index) => ({ label: text(beat, key), at: num(beat, `t${index + 1}`) }));
  const lockedAt = num(beat, "lockedAt");
  const moreAt = num(beat, "moreAt");
  const logoIn = interpolate(local, [logoAt, logoAt + 4], [0, 1], clamp);
  const draw = interpolate(local, [logoAt, logoAt + num(beat, "logoDraw")], [0, 1], clamp);
  return (
    <AbsoluteFill>
      <CloseDim beat={beat} local={local} />
      <AbsoluteFill style={reveal(listOut)}>
        <Column>
          <Header title={upper(beat.title)} size={66} />
          <div {...box("kontrol-listesi")} style={{ ...GLASS, borderRadius: 14, padding: "8px 24px" }}>
            {items.map((item, index) => {
              const on = interpolate(local, [item.at, item.at + 6], [0, 1], clamp);
              return (
                <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 20, height: 84, borderTop: index ? "2px solid rgba(255,255,255,0.12)" : undefined }}>
                  <div data-fill style={{ width: 54, height: 54, borderRadius: 8, border: `4px solid ${on > 0 ? GREEN : "rgba(246,248,244,0.6)"}`, boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Check progress={on} size={46} />
                  </div>
                  <span style={{ ...labelFont, fontSize: 46, color: INK, opacity: 0.55 + 0.45 * on }}>{upper(item.label)}</span>
                </div>
              );
            })}
            {[0, 1, 2].map((index) => (
              <div key={`lock${index}`} style={{ display: "flex", alignItems: "center", gap: 20, height: 70, borderTop: "2px solid rgba(255,255,255,0.12)", opacity: interpolate(local, [lockedAt + index * 3, lockedAt + index * 3 + 6], [0, 1], clamp) }}>
                <Lock />
                <div data-fill style={{ height: 30, width: [420, 360, 470][index], borderRadius: 15, background: "rgba(246,248,244,0.55)", filter: "blur(9px)" }} />
              </div>
            ))}
          </div>
          <div {...box("daha-fazla")} style={{ alignSelf: "center", ...GLASS, borderRadius: 10, padding: "10px 22px 8px", ...labelFont, fontSize: 44, color: GREEN_TEXT, ...reveal(interpolate(local, [moreAt, moreAt + 6], [0, 1], clamp)) }}>
            {upperKeepSite(text(beat, "more"))}
          </div>
        </Column>
      </AbsoluteFill>
      <div {...box("kapanış-logosu", true)} style={{ position: "absolute", left: 90, width: 790, top: 700, display: "flex", flexDirection: "column", alignItems: "center", opacity: logoIn > 0 ? 1 : 0, ...reveal(logoIn) }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <Img src={staticFile("brand/checkmatch-logo.png")} style={{ width: 560, height: Math.round((560 * 248) / 1269) }} />
          <Check progress={draw} size={120} />
        </div>
        <div style={{ marginTop: 40, ...bodyFont, fontSize: 60, color: INK }}>{script.site}</div>
      </div>
    </AbsoluteFill>
  );
}
