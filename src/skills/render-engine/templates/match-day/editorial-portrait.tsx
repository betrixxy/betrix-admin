import type { MatchDayCard } from "@/types/match-day";
import type { TemplateGeometry } from "./geometry";
import { BrandLogo, Canvas, Eyebrow, LeagueLogo, SERIF, TEXT_SHADOW, TeamLogo, clip, fitFontSize, known, px } from "./shared";

/**
 * EDITORIAL PORTRAIT — spor dergisi kapağı: dramatik stüdyo ışığında oyuncu portreleri,
 * serif takım adları kademeli dizilir ("Italy / vs / Türkiye"), künye açık harf aralıklı
 * küçük başlıklarla. Takım adları kullanıcının yazdığı haliyle (büyük harf zorlanmaz).
 */

function Rule({ width }: { width: number }) {
  return <div tw="flex" style={{ width, height: 1, backgroundColor: "rgba(255,255,255,0.45)" }} />;
}

function Masthead({ card, k, width }: { card: MatchDayCard; k: number; width: number }) {
  return (
    <div tw="flex items-center justify-between" style={{ width }}>
      <LeagueLogo card={card} size={px(46, k)} />
      <div tw="flex items-center">
        <Rule width={px(70, k)} />
        <div tw="flex" style={{ margin: `0 ${px(18, k)}px` }}>
          <Eyebrow size={px(16, k)} color="white">MAÇ GÜNÜ</Eyebrow>
        </div>
        <Rule width={px(70, k)} />
      </div>
      <Eyebrow size={px(12, k)} color="rgba(255,255,255,0.7)">{card.weekLabel ?? ""}</Eyebrow>
    </div>
  );
}

function Names({ card, k, width }: { card: MatchDayCard; k: number; width: number }) {
  const size = Math.min(
    fitFontSize(card.homeTeamName, width * 0.9, px(124, k), 0.5),
    fitFontSize(card.awayTeamName, width * 0.9, px(124, k), 0.5),
  );
  const name = (text: string, align: "flex-start" | "flex-end") => (
    <div tw="flex" style={{ width, justifyContent: align }}>
      <span style={{ fontFamily: SERIF, fontSize: size, lineHeight: 0.98, color: "white", textShadow: TEXT_SHADOW }}>{text}</span>
    </div>
  );
  // Büyük adlarda "vs" satırlara sıkıca yaslanır (negatif boşluk); uzun adlar küçüldüğünde ise
  // "vs" okunur boyutta kalır ve satırlarla çakışmasın diye pozitif boşluk alır.
  const compact = size < px(80, k);
  const vsSize = Math.max(size * 0.42, px(22, k));
  const vsGap = compact ? Math.round(size * 0.15) : px(-6, k);
  return (
    <div tw="flex flex-col">
      {name(card.homeTeamName, "flex-start")}
      <div tw="flex" style={{ width, justifyContent: "center", margin: `${vsGap}px 0` }}>
        <span style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: vsSize, lineHeight: 1, color: "rgba(255,255,255,0.85)" }}>vs</span>
      </div>
      {name(card.awayTeamName, "flex-end")}
    </div>
  );
}

function Credits({ card, k }: { card: MatchDayCard; k: number }) {
  const line = [known(card.dateLabel), known(card.timeLabel)].filter(Boolean).join("  ·  ");
  const stadium = known(card.stadiumLabel);
  const referee = known(card.refereeLabel);
  const sub = [stadium ? clip(stadium, 34) : null, referee ? `Hakem ${referee}` : null].filter(Boolean).join("  ·  ");
  return (
    <div tw="flex flex-col items-center">
      <div tw="flex items-center">
        <TeamLogo src={card.homeLogo} name={card.homeTeam} size={px(44, k)} />
        <div tw="flex flex-col items-center" style={{ margin: `0 ${px(24, k)}px` }}>
          {line ? <Eyebrow size={px(16, k)} color="white">{line.toLocaleUpperCase("tr-TR")}</Eyebrow> : null}
          {sub ? (
            <div tw="flex" style={{ marginTop: line ? px(6, k) : 0 }}>
              <Eyebrow size={px(11, k)} color="rgba(255,255,255,0.62)">{sub.toLocaleUpperCase("tr-TR")}</Eyebrow>
            </div>
          ) : null}
        </div>
        <TeamLogo src={card.awayLogo} name={card.awayTeam} size={px(44, k)} />
      </div>
    </div>
  );
}

function Vertical({ card, g }: { card: MatchDayCard; g: TemplateGeometry }) {
  const { k } = g;
  const width = g.right - g.left;
  return (
    <Canvas>
      <div tw="absolute flex" style={{ left: g.left, top: g.top }}>
        <Masthead card={card} k={k} width={width} />
      </div>
      <div tw="absolute flex" style={{ left: g.left, top: g.blockTop }}>
        <Names card={card} k={k} width={width} />
      </div>
      <div tw="absolute flex flex-col items-center" style={{ left: 0, right: 0, bottom: g.frame.height - g.bottom }}>
        <Credits card={card} k={k} />
        <div tw="flex" style={{ marginTop: px(18, k) }}>
          <BrandLogo card={card} height={px(26, k)} />
        </div>
      </div>
    </Canvas>
  );
}

function Landscape({ card, g }: { card: MatchDayCard; g: TemplateGeometry }) {
  const left = 650;
  const width = g.right - left;
  return (
    <Canvas>
      <div tw="absolute flex flex-col" style={{ left, top: g.top, width }}>
        <Masthead card={card} k={0.8} width={width} />
        <div tw="flex" style={{ marginTop: 56 }}>
          <Names card={card} k={0.78} width={width} />
        </div>
        <div tw="flex" style={{ marginTop: 36, justifyContent: "center" }}>
          <Credits card={card} k={0.72} />
        </div>
      </div>
      <div tw="absolute flex" style={{ right: g.left, bottom: 30 }}>
        <BrandLogo card={card} height={22} />
      </div>
    </Canvas>
  );
}

export function EditorialPortraitTemplate({ card, g }: { card: MatchDayCard; g: TemplateGeometry }) {
  return g.frame.orientation === "landscape" ? <Landscape card={card} g={g} /> : <Vertical card={card} g={g} />;
}
