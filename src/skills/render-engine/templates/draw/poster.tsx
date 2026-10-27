import type { DrawCard, DrawKnockoutPoster, DrawLeagueCarousel } from "@/types/draw";
import { blockOpacity, type BlockFilter } from "../checkmatch-set/blocks";
import { SetFooter, SetHeader } from "../checkmatch-set/set-parts";
import { BODY, DISPLAY, TeamLogo, fitFontSize, px } from "../match-day/shared";
import { DRAW_SIZES, type DrawPosterGeometry } from "./geometry";
import { Caps, MUTED, PosterShade, TEXT_SHADOW } from "./parts";

/**
 * A · TAKIM ODAKLI posterler — tam kadraj oyuncu fotoğrafı (sanat katmanı, motor) üstünde yazı yığını:
 * eleme: takım satırı ← dev rakip adı + logosu ← "İLK MAÇ DEPLASMANDA" + tarihler ← olgu (varsa);
 * lig aşaması: takım satırı ← "RAKİPLER BELLİ OLDU" ← "8 RAKİP · 4 İÇ SAHA · 4 DEPLASMAN".
 */

function Kicker({ name, logo, g, only }: { name: string; logo: string | null; g: DrawPosterGeometry; only: BlockFilter }) {
  const s = DRAW_SIZES;
  const logoSize = g.kicker.height;
  const width = g.column.right - g.column.left - logoSize - px(14, g.k);
  const size = fitFontSize(name, width, px(s.kickerText, g.k), 0.72 + 0.2, px(12, g.k));
  return (
    <div tw="absolute flex items-center" style={{ left: g.column.left, top: g.kicker.top, height: g.kicker.height, opacity: blockOpacity(only, "draw-kicker") }}>
      <TeamLogo src={logo} name={name} size={logoSize} />
      <span style={{ fontFamily: BODY, fontWeight: 800, fontSize: size, lineHeight: 1, letterSpacing: size * 0.2, color: "#fff", marginLeft: px(14, g.k), textShadow: TEXT_SHADOW }}>{name}</span>
    </div>
  );
}

function KnockoutBody({ body, card, g, only }: { body: DrawKnockoutPoster; card: DrawCard; g: DrawPosterGeometry; only: BlockFilter }) {
  const s = DRAW_SIZES;
  const { k } = g;
  const width = g.column.right - g.column.left;
  const logo = px(s.heroLogo, k);
  const nameWidth = width - logo - px(32, k);
  // Anton aksanları (Ö, Ç) em kutusunun dışına taşar — ad yuvanın %86'sıyla sınırlı.
  const size = fitFontSize(body.opponent.name, nameWidth, Math.round(px(s.heroName, k) * 0.86), 0.47, px(36, k));
  const factSize = fitFontSize(body.fact, width, px(s.fact, k), 0.56, px(14, k));
  return (
    <>
      <Kicker name={`${body.team.name} · RAKİP`} logo={body.team.logo} g={g} only={only} />
      <div tw="absolute flex items-center" style={{ left: g.column.left, top: g.hero.top, width, height: g.hero.height, opacity: blockOpacity(only, "draw-hero") }}>
        <TeamLogo src={body.opponent.logo} name={body.opponent.name} size={logo} />
        <span style={{ fontFamily: DISPLAY, fontSize: size, lineHeight: 1, color: "#fff", marginLeft: px(32, k), textShadow: TEXT_SHADOW }}>{body.opponent.name}</span>
      </div>
      <div tw="absolute flex flex-col" style={{ left: g.column.left, top: g.meta.top, width, height: g.meta.height, opacity: blockOpacity(only, "draw-meta") }}>
        <Caps text={body.order} size={px(s.order, k)} color={card.accentHex} weight={900} spacing={0.16} maxWidth={width} />
        {body.dates ? <div tw="flex" style={{ marginTop: px(s.orderGap, k) }}><Caps text={body.dates} size={px(s.dates, k)} maxWidth={width} /></div> : null}
      </div>
      {body.fact ? (
        <div tw="absolute flex items-center" style={{ left: g.column.left, top: g.fact.top, width, height: g.fact.height, opacity: blockOpacity(only, "draw-fact") }}>
          <span style={{ fontFamily: BODY, fontWeight: 600, fontSize: factSize, lineHeight: 1, color: "#fff", textShadow: TEXT_SHADOW }}>{body.fact}</span>
        </div>
      ) : null}
    </>
  );
}

function LeagueBody({ body, card, g, only }: { body: DrawLeagueCarousel; card: DrawCard; g: DrawPosterGeometry; only: BlockFilter }) {
  const s = DRAW_SIZES;
  const width = g.column.right - g.column.left;
  const headline = "RAKİPLER BELLİ OLDU";
  const size = fitFontSize(headline, width, px(s.headline, g.k), 0.47, px(40, g.k));
  return (
    <>
      <Kicker name={body.team.name} logo={body.team.logo} g={g} only={only} />
      <div tw="absolute flex items-end" style={{ left: g.column.left, top: g.hero.top, width, height: g.hero.height, opacity: blockOpacity(only, "draw-hero") }}>
        <span style={{ fontFamily: DISPLAY, fontSize: size, lineHeight: 1, color: "#fff", textShadow: TEXT_SHADOW }}>{headline}</span>
      </div>
      <div tw="absolute flex items-center" style={{ left: g.column.left, top: g.meta.top, width, height: g.meta.height, opacity: blockOpacity(only, "draw-meta") }}>
        <Caps text={body.summary} size={px(s.summary, g.k)} color={card.accentHex} weight={800} maxWidth={width} />
      </div>
    </>
  );
}

export function DrawPosterTemplate({ card, g, only }: { card: DrawCard; g: DrawPosterGeometry; only?: BlockFilter }) {
  const s = DRAW_SIZES;
  const { body } = card;
  return (
    <div tw="relative flex h-full w-full" style={{ fontFamily: BODY, color: MUTED }}>
      <PosterShade g={g} only={only} />
      <SetHeader card={{ pageLabel: card.pageLabels[0], dateLabel: card.dateLabel, accentHex: card.accentHex }} box={g.box} k={g.k} only={only} />
      {body.kind === "TEAM_KNOCKOUT" ? <KnockoutBody body={body} card={card} g={g} only={only} /> : null}
      {body.kind === "TEAM_LEAGUE" ? <LeagueBody body={body} card={card} g={g} only={only} /> : null}
      <SetFooter card={{ competitionLabel: card.footerLine, roundLabel: "", brandLogo: card.brandLogo }} box={g.box} size={px(s.footerSize, g.k)} logoHeight={px(s.logoHeight, g.k)} only={only} />
    </div>
  );
}
