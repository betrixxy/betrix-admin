import { LandscapeSetColumn } from "../checkmatch-set/landscape";
import { SetHeader, SET_VERTICAL, SetFooter, SetScoreBlock } from "../checkmatch-set/set-parts";
import { BODY, px } from "../match-day/shared";
import { MvpLine, Shade, type ResultTemplateProps } from "./shared";

/**
 * A · TAM KADRAJ (varsayılan) — gerçek maç fotoğrafı tüm kartı kaplar (sharp katmanı: akıllı
 * kırpma + tonlama, bkz. `lib/dashboard/match-photo/`). Bu katman yalnızca okunurluk gradyanını
 * ve set yazılarını çizer: dikeyde alttaki skor şeridi + golcüler set bloğudur (`SetScoreBlock`),
 * 02 İstatistik kartıyla birebir aynı yerde durur; 16:9'da set sütunu (`LandscapeSetColumn`).
 * "MAÇIN OYUNCUSU" satırı isteğe bağlıdır (yuva sabit, şerit kaymaz).
 */
export function FullFrameTemplate({ card, g, shadeStrength, only }: ResultTemplateProps) {
  const { k, frame } = g;
  const headline = <MvpLine card={card} size={g.column ? 15 : px(20, k)} />;
  return (
    <div tw="relative flex h-full w-full" style={{ fontFamily: BODY }}>
      <Shade g={g} strength={shadeStrength} only={only} />
      <SetHeader card={card} box={g} k={g.column ? 0.8 : k} only={only} />
      {g.column ? (
        <LandscapeSetColumn card={card} box={g.column} headline={headline} only={only} />
      ) : (
        <SetScoreBlock card={card} box={g} frameHeight={frame.height} k={k} headline={headline} only={only} />
      )}
      {g.column ? (
        <SetFooter card={card} box={g} size={17} logoHeight={26} only={only} />
      ) : (
        <SetFooter card={card} box={g} size={px(SET_VERTICAL.footerSize, k)} logoHeight={px(SET_VERTICAL.logoHeight, k)} only={only} />
      )}
    </div>
  );
}
