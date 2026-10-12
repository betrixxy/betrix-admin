import type { TeamAnalysisDraft } from "@/types/deep-analysis";
import { SOCIAL_FORMATS, type SocialFormatId } from "@/types/studio-formats";
import { DeepAnalysisBackdrop, DeepAnalysisCorner } from "./deep-analysis-backdrop";
import { deepAnalysisBlocks, type DeepAnalysisBlocks } from "./deep-analysis-sections";
import { BODY, GREEN, HERO_HEIGHT, NAVY_800 } from "./deep-analysis-tokens";

/**
 * DERİNLEMESİNE ANALİZ — tek takımlık analiz kartı (Satori; boyut seçilen formattan, bkz. types/studio-formats.ts).
 *
 * Birebir kaynak: CheckMatch içerik motorunun `templates/team-analysis/template.html` +
 * `brand/tokens.css` (referans çıktı: `3-derin-analiz-A-takim.png`, aynı şablonun 2x'i). Renkler,
 * ölçüler, font rolleri ve bölüm sırası oradan alınmıştır. Satori'ye uyarlanan noktalar:
 * - `writing-mode` yok → kenar filigranı 90° döndürülmüş metindir.
 * - "✓" ve "⚙" glifleri fontlarda yok → aynı görünümde inline SVG.
 * - Manrope'un italiği yok → alıntı metni hafif eğik (skew) çizilir (tarayıcının sahte italiği gibi).
 * Boş bölüm çizilmez; her metin stüdyo formundan gelir.
 *
 * Yerleşimler: 4:5 kaynak şablonun kendisidir; 9:16 aynı yerleşimi platform bantlarının (üst 250 / alt
 * 320px) içine alır; 1:1 kapağı banda indirip bölümleri iki sütuna dizer; 16:9 solda kapak + başlık +
 * güçlü/zayıf yönler, sağda oyuncular + istatistik + yaklaşım + alıntı olarak yatay eksene yayılır.
 */

export interface DeepAnalysisCardData {
  team: TeamAnalysisDraft;
  opponentName: string;
  format: SocialFormatId;
  /** CheckMatch logosu (".net"siz, data URL). */
  brandLogo: string;
  eyebrow?: string;
  sideText?: string;
  quoteAttribution?: string;
}

/** Kapak görseli kaynak oranı (analysis-hero-compose.ts HERO_SIZE: 1080×460). */
const HERO_RATIO = HERO_HEIGHT / 1080;

/** 4:5 ve 9:16: kaynak şablon, içerik `top`..`bottom` arasında (Story'de güvenli alanın içi). */
function SingleColumn({ blocks, hero, width, top, bottom }: { blocks: DeepAnalysisBlocks; hero: string; width: number; top: number; bottom: number }) {
  const contentTop = hero ? top + HERO_HEIGHT - 24 : top;
  return (
    <>
      {/* Kapak (oyuncu kesimi + sahne, 1080×460): filigranın üstünde (oyuncuya binmesin), başlık sol gölgeli alanına biner. */}
      {hero ? (
        // eslint-disable-next-line @next/next/no-img-element -- Satori yalnızca düz <img> okur.
        <img src={hero} alt="" width={1080} height={HERO_HEIGHT} style={{ position: "absolute", left: 0, top }} />
      ) : null}
      {hero ? (
        <div tw="flex" style={{ position: "absolute", left: 64, top: top + HERO_HEIGHT - 190, width: 560 }}>
          {blocks.header(true)}
        </div>
      ) : null}
      <DeepAnalysisCorner top={top} />
      {/*
        İçerik: kapaksız kartta tüm tuvalde dikey ortalı, 24px aralıklı (kaynak şablon); kapaklı kartta
        kapağın altındaki alanda, sıkışmasın diye 18px aralıklı. Yan boşluk 64px.
      */}
      <div
        tw="flex flex-col items-center justify-center"
        style={{ position: "absolute", left: 0, top: contentTop, width, height: bottom - contentTop, padding: hero ? "0 64px 28px" : "0 64px", gap: hero ? 18 : 24 }}
      >
        {hero ? null : blocks.header(false)}
        {blocks.points(false)}
        {blocks.players(false)}
        {blocks.stats}
        {blocks.approach}
        {blocks.quote}
        {blocks.brand}
      </div>
    </>
  );
}

/** 1:1: kapak üstte kırpılmış bant (oyuncunun başı korunur), altında iki sütun, en altta yaklaşım + alıntı. */
function SquareGrid({ blocks, hero, width, height }: { blocks: DeepAnalysisBlocks; hero: string; width: number; height: number }) {
  const band = 330;
  const contentTop = hero ? band - 10 : 0;
  return (
    <>
      {hero ? (
        <div tw="flex" style={{ position: "absolute", left: 0, top: 0, width, height: band, overflow: "hidden" }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- Satori yalnızca düz <img> okur. */}
          <img src={hero} alt="" width={width} height={Math.round(width * HERO_RATIO)} style={{ position: "absolute", left: 0, top: -30 }} />
        </div>
      ) : null}
      {hero ? (
        <div tw="flex" style={{ position: "absolute", left: 56, top: band - 132, width: 520 }}>
          {blocks.header(true)}
        </div>
      ) : null}
      <DeepAnalysisCorner top={0} />
      <div
        tw="flex flex-col items-center justify-center"
        style={{ position: "absolute", left: 0, top: contentTop, width, height: height - contentTop, padding: hero ? "0 56px 22px" : "28px 56px", gap: 14 }}
      >
        {hero ? null : blocks.header(false)}
        <div tw="flex" style={{ width: "100%", gap: 16 }}>
          <div tw="flex flex-col" style={{ flex: 1, gap: 14 }}>
            {blocks.points(true)}
          </div>
          <div tw="flex flex-col" style={{ flex: 1, gap: 14 }}>
            {blocks.players(true)}
            {blocks.stats}
          </div>
        </div>
        {blocks.approach}
        {blocks.quote}
        {blocks.brand}
      </div>
    </>
  );
}

/** 16:9: sol sütun kapak/başlık + güçlü-zayıf yönler, sağ sütun oyuncular + istatistik + yaklaşım + alıntı + imza. */
function LandscapeGrid({ blocks, hero, width, height }: { blocks: DeepAnalysisBlocks; hero: string; width: number; height: number }) {
  const pad = 64;
  const left = 860;
  const gap = 48;
  const heroHeight = Math.round(left * HERO_RATIO);
  return (
    <>
      <div tw="flex flex-col justify-center" style={{ position: "absolute", left: pad, top: 48, width: left, height: height - 96, gap: 22 }}>
        {hero ? (
          <div tw="flex" style={{ position: "relative", width: left, height: heroHeight, borderRadius: 18, overflow: "hidden" }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- Satori yalnızca düz <img> okur. */}
            <img src={hero} alt="" width={left} height={heroHeight} style={{ position: "absolute", left: 0, top: 0 }} />
            <div tw="flex" style={{ position: "absolute", left: 36, bottom: 30, width: 480 }}>
              {blocks.header(true)}
            </div>
          </div>
        ) : (
          blocks.header(false)
        )}
        {blocks.points(false)}
      </div>
      <div tw="flex flex-col items-center justify-center" style={{ position: "absolute", left: pad + left + gap, top: 48, width: width - pad - left - gap - 96, height: height - 96, gap: 20 }}>
        {blocks.players(false)}
        {blocks.stats}
        {blocks.approach}
        {blocks.quote}
        {blocks.brand}
      </div>
      <DeepAnalysisCorner top={0} />
    </>
  );
}

export function DeepAnalysisCard({
  team,
  opponentName,
  format,
  brandLogo,
  eyebrow = "Derinlemesine Analiz",
  sideText = "Analiz",
  quoteAttribution = "CheckMatch Analiz",
}: DeepAnalysisCardData) {
  const { width, height, safeTop, safeBottom } = SOCIAL_FORMATS[format];
  const hero = team.heroImageUrl;
  const text = { team, opponentName, brandLogo, eyebrow, quoteAttribution };
  const top = safeTop;
  const bottom = height - safeBottom;

  return (
    <div tw="relative flex h-full w-full" style={{ fontFamily: BODY, color: "white", backgroundColor: NAVY_800, overflow: "hidden" }}>
      <DeepAnalysisBackdrop
        width={width}
        height={bottom - top}
        top={top}
        bottom={bottom}
        glow={team.colorHex || GREEN}
        sideText={sideText}
        sideTextTop={hero && format !== "landscape" && format !== "square" ? top + HERO_HEIGHT : top}
      />
      {format === "landscape" ? (
        <LandscapeGrid blocks={deepAnalysisBlocks(text, 1)} hero={hero} width={width} height={height} />
      ) : format === "square" ? (
        <SquareGrid blocks={deepAnalysisBlocks(text, 0.8)} hero={hero} width={width} height={height} />
      ) : (
        <SingleColumn blocks={deepAnalysisBlocks(text, 1)} hero={hero} width={width} top={top} bottom={bottom} />
      )}
    </div>
  );
}
