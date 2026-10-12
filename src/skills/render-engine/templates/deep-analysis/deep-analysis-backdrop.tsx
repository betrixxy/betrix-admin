import { BODY, GREEN, GREEN_BR, GREEN_DK, rgba } from "./deep-analysis-tokens";

/**
 * Kartın zemin katmanları (tüm formatlar): takım rengi parıltısı, sağ kenar filigranı ve sol üst marka
 * köşesi. `top`/`bottom` içerik alanının sınırlarıdır — Story'de platform bantlarının içinde kalır.
 */
export function DeepAnalysisBackdrop({
  width,
  height,
  top,
  bottom,
  glow,
  sideText,
  sideTextTop,
}: {
  width: number;
  height: number;
  /** İçerik alanının üstü/altı (4:5'te 0 ve 1350). */
  top: number;
  bottom: number;
  glow: string;
  sideText: string;
  /** Filigranın başladığı y (kapaklı kartta kapağın altı). */
  sideTextTop: number;
}) {
  return (
    <>
      {/*
        Takım rengi parıltısı — kaynak: `radial-gradient(80% 45% at 50% 0%, glow .45 0%, transparent 60%)`
        ve `radial-gradient(70% 40% at 50% 100%, glow .22 0%, transparent 65%)`. Satori elips boyutu
        (80% 45%) ve `closest-side` okumaz; aynı elips, merkezlenmiş bir kutunun varsayılan
        (farthest-corner) gradyanında %70.7 durağıyla elde edilir: o durak tam kutu kenarına denk gelir.
        Üst: yarıçap 864×0.60 = 518, 607×0.60 = 364 · Alt: 756×0.65 = 491, 540×0.65 = 351.
      */}
      <div
        style={{
          position: "absolute",
          left: width / 2 - 518,
          top: top - 364,
          width: 1036,
          height: 728,
          backgroundImage: `radial-gradient(${rgba(glow, 0.45)} 0%, ${rgba(glow, 0)} 70.7%)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: width / 2 - 491,
          top: bottom - 351,
          width: 982,
          height: 702,
          backgroundImage: `radial-gradient(${rgba(glow, 0.22)} 0%, ${rgba(glow, 0)} 70.7%)`,
        }}
      />

      {/* Sağ kenar filigranı (.cm-sidetext): dikey metin, %16 opak yeşil. Satori'de writing-mode yok — tuval
          yüksekliğinde yatay bir kutu merkezinden 90° döndürülür. */}
      <div tw="flex" style={{ position: "absolute", right: -6, top: sideTextTop, width: 80, height }}>
        <div tw="flex items-center" style={{ position: "absolute", left: (80 - height) / 2, top: (height - 80) / 2, width: height, height: 80, transform: "rotate(90deg)" }}>
          <span style={{ fontFamily: BODY, fontWeight: 800, fontSize: 62, letterSpacing: 6, color: GREEN, opacity: 0.16, whiteSpace: "nowrap" }}>
            {`${sideText}  ${sideText}`}
          </span>
        </div>
      </div>
    </>
  );
}

/** Sol üst marka köşesi: kalın diyagonal yeşil şerit (.cm-corner) — kapağın üstünde çizilir. */
export function DeepAnalysisCorner({ top }: { top: number }) {
  return (
    <div tw="flex" style={{ position: "absolute", left: 0, top, width: 220, height: 220, overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          left: -80,
          top: 50,
          width: 320,
          height: 46,
          transform: "rotate(-45deg)",
          backgroundImage: `linear-gradient(100deg, ${GREEN_BR} 0%, ${GREEN} 55%, ${GREEN_DK} 100%)`,
          boxShadow: "0 8px 16px rgba(0,0,0,0.35)",
        }}
      />
    </div>
  );
}
