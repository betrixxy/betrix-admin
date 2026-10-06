import type { TeamAnalysisDraft } from "@/types/deep-analysis";
import { BangGlyph, CheckGlyph, Eyebrow, GearGlyph, KeyPlayer, PointColumn, StatRow } from "./deep-analysis-parts";
import { BODY, GRAY, GREEN, GREEN_BR, GREEN_DK, HERO_HEIGHT, MAX_WIDTH, NAVY_800, SCORE, TEAM, YELLOW, filled, rgba, upper } from "./deep-analysis-tokens";

/**
 * DERİNLEMESİNE ANALİZ — tek takımlık analiz kartı (Satori, 1080×1350 / IG 4:5).
 *
 * Birebir kaynak: CheckMatch içerik motorunun `templates/team-analysis/template.html` +
 * `brand/tokens.css` (referans çıktı: `3-derin-analiz-A-takim.png`, aynı şablonun 2x'i). Renkler,
 * ölçüler, font rolleri ve bölüm sırası oradan alınmıştır. Satori'ye uyarlanan noktalar:
 * - `writing-mode` yok → kenar filigranı 90° döndürülmüş metindir.
 * - "✓" ve "⚙" glifleri fontlarda yok → aynı görünümde inline SVG.
 * - Manrope'un italiği yok → alıntı metni hafif eğik (skew) çizilir (tarayıcının sahte italiği gibi).
 * Boş bölüm çizilmez; her metin stüdyo formundan gelir.
 */


export const DEEP_ANALYSIS_SIZE = { width: 1080, height: 1350 } as const;

export interface DeepAnalysisCardData {
  team: TeamAnalysisDraft;
  opponentName: string;
  /** CheckMatch.net logosu (data URL). */
  brandLogo: string;
  eyebrow?: string;
  sideText?: string;
  quoteAttribution?: string;
}


export function DeepAnalysisCard({
  team,
  opponentName,
  brandLogo,
  eyebrow = "Derinlemesine Analiz",
  sideText = "Analiz",
  quoteAttribution = "CheckMatch Analiz",
}: DeepAnalysisCardData) {
  const strengths = filled(team.strengths).slice(0, 3);
  const cautions = filled(team.cautions).slice(0, 3);
  const players = team.keyPlayers.filter((player) => player.name.trim()).slice(0, 3);
  const approach = team.approach.trim();
  const quote = team.quote.trim();
  const glow = team.colorHex || GREEN;
  const hero = team.heroImageUrl;

  const header = (
    <div tw="flex items-center" style={{ gap: 20, justifyContent: hero ? "flex-start" : "center" }}>
      {team.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- Satori yalnızca düz <img> okur.
        <img src={team.logoUrl} alt="" width={76} height={76} style={{ objectFit: "contain" }} />
      ) : null}
      <div tw="flex flex-col">
        <Eyebrow color={GRAY} size={16} spacing={3} opacity={0.8}>
          {eyebrow}
        </Eyebrow>
        <span style={{ fontFamily: TEAM, fontWeight: 800, fontSize: hero ? 52 : 44, letterSpacing: 0.3, lineHeight: 1.05, marginTop: 2 }}>
          {upper(team.teamName)}
        </span>
      </div>
    </div>
  );

  return (
    <div tw="relative flex h-full w-full" style={{ fontFamily: BODY, color: "white", backgroundColor: NAVY_800, overflow: "hidden" }}>
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
          left: 540 - 518,
          top: -364,
          width: 1036,
          height: 728,
          backgroundImage: `radial-gradient(${rgba(glow, 0.45)} 0%, ${rgba(glow, 0)} 70.7%)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 540 - 491,
          top: 1350 - 351,
          width: 982,
          height: 702,
          backgroundImage: `radial-gradient(${rgba(glow, 0.22)} 0%, ${rgba(glow, 0)} 70.7%)`,
        }}
      />

      {/* Sağ kenar filigranı (.cm-sidetext): üstten (kapaklı kartta kapağın altından) başlayan dikey metin, %16 opak yeşil. Satori'de
          writing-mode yok — tuval yüksekliğinde yatay bir kutu merkezinden 90° döndürülür. */}
      <div tw="flex" style={{ position: "absolute", right: -6, top: hero ? HERO_HEIGHT : 0, width: 80, height: 1350 }}>
        <div
          tw="flex items-center"
          style={{ position: "absolute", left: (80 - 1350) / 2, top: (1350 - 80) / 2, width: 1350, height: 80, transform: "rotate(90deg)" }}
        >
          <span style={{ fontFamily: BODY, fontWeight: 800, fontSize: 62, letterSpacing: 6, color: GREEN, opacity: 0.16, whiteSpace: "nowrap" }}>
            {`${sideText}  ${sideText}`}
          </span>
        </div>
      </div>

      {/* Kapak (oyuncu kesimi + sahne, 1080×460): filigranın üstünde (oyuncuya binmesin), başlık sol gölgeli alanına biner. */}
      {hero ? (
        // eslint-disable-next-line @next/next/no-img-element -- Satori yalnızca düz <img> okur.
        <img src={hero} alt="" width={1080} height={HERO_HEIGHT} style={{ position: "absolute", left: 0, top: 0 }} />
      ) : null}
      {hero ? (
        <div tw="flex" style={{ position: "absolute", left: 64, top: HERO_HEIGHT - 190, width: 560 }}>
          {header}
        </div>
      ) : null}

      {/* Sol üst marka köşesi: kalın diyagonal yeşil şerit (.cm-corner). */}
      <div tw="flex" style={{ position: "absolute", left: 0, top: 0, width: 220, height: 220, overflow: "hidden" }}>
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

      {/*
        İçerik: kapaksız kartta tüm tuvalde dikey ortalı, 24px aralıklı (kaynak şablon); kapaklı kartta
        kapağın altındaki alanda, sıkışmasın diye 18px aralıklı. Yan boşluk 64px.
      */}
      <div
        tw="flex flex-col items-center justify-center"
        style={{ position: "absolute", left: 0, right: 0, top: hero ? HERO_HEIGHT - 24 : 0, bottom: 0, padding: hero ? "0 64px 28px" : "0 64px", gap: hero ? 18 : 24 }}
      >
        {hero ? null : header}

        {strengths.length + cautions.length > 0 ? (
          <div tw="flex" style={{ width: "100%", maxWidth: MAX_WIDTH, gap: 26 }}>
            {strengths.length > 0 ? <PointColumn title="Güçlü Yönler" color={GREEN_BR} points={strengths} glyph={<CheckGlyph />} /> : null}
            {cautions.length > 0 ? <PointColumn title="Dikkat Edilmesi Gerekenler" color={YELLOW} points={cautions} glyph={<BangGlyph />} /> : null}
          </div>
        ) : null}

        {players.length > 0 ? (
          <div tw="flex flex-col" style={{ width: "100%", maxWidth: MAX_WIDTH }}>
            <div tw="flex justify-center" style={{ marginBottom: 12 }}>
              <Eyebrow color={GRAY} spacing={1.5} opacity={0.8}>
                Anahtar Oyuncular
              </Eyebrow>
            </div>
            <div tw="flex" style={{ gap: 18 }}>
              {players.map((player, index) => (
                <KeyPlayer key={index} {...player} />
              ))}
            </div>
          </div>
        ) : null}

        <StatRow stats={team.stats} />

        {approach ? (
          <div
            tw="flex flex-col"
            style={{
              width: "100%",
              maxWidth: MAX_WIDTH,
              padding: "18px 24px",
              borderRadius: 14,
              border: "1.5px solid rgba(245,197,24,0.5)",
              backgroundImage: "linear-gradient(160deg, rgba(245,197,24,0.1), rgba(245,197,24,0.02))",
            }}
          >
            <div tw="flex items-center" style={{ marginBottom: 8 }}>
              <GearGlyph />
              <Eyebrow color={YELLOW}>{`${opponentName} Karşısında Önerilen Yaklaşım`}</Eyebrow>
            </div>
            <span style={{ fontFamily: BODY, fontWeight: 500, fontSize: 17.5, lineHeight: 1.4 }}>{approach}</span>
          </div>
        ) : null}

        {quote ? (
          <div tw="flex flex-col" style={{ width: "100%", maxWidth: MAX_WIDTH, borderLeft: `4px solid ${GREEN}`, borderRadius: 4, padding: "2px 0 2px 24px" }}>
            <span style={{ fontFamily: SCORE, fontSize: 40, color: GREEN_BR, lineHeight: 0.8, height: 22, marginBottom: 4 }}>&quot;</span>
            <span style={{ fontFamily: BODY, fontWeight: 500, fontSize: 19, lineHeight: 1.38, color: GRAY, transform: "skewX(-9deg)" }}>{quote}</span>
            <div tw="flex" style={{ marginTop: 8 }}>
              <Eyebrow color={GREEN_BR} size={13} spacing={1.5}>
                {quoteAttribution}
              </Eyebrow>
            </div>
          </div>
        ) : null}

        {/* Marka imzası: logo + altın çizgi (.cm-brandmark). */}
        <div tw="flex flex-col items-center" style={{ gap: 9 }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- Satori yalnızca düz <img> okur. */}
          <img src={brandLogo} alt="CheckMatch.net" width={246} height={40} />
          <div style={{ width: 420, height: 2, backgroundImage: `linear-gradient(90deg, rgba(245,197,24,0), ${YELLOW} 15%, ${YELLOW} 85%, rgba(245,197,24,0))` }} />
        </div>
      </div>
    </div>
  );
}
