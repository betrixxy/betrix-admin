import type { DrawCard, DrawTurkishCard, DrawTurkishRow } from "@/types/draw";
import { DRAW_LIST_LAYERS, blockOpacity, layerOpacity, type BlockFilter } from "../checkmatch-set/blocks";
import { SetFooter, SetHeader } from "../checkmatch-set/set-parts";
import { BODY, DISPLAY, DISPLAY_ACCENT_EM, DISPLAY_DESCENT_EM, TeamLogo, fitFontSize, px } from "../match-day/shared";
import { DRAW_SIZES, type DrawListGeometry } from "./geometry";
import { Caps, ListTitle, MUTED, VENUE_ICON_EM, VenueTag } from "./parts";

/**
 * B · TEMSİLCİLERİMİZ — Türk takımlarının hepsi tek kartta (1–5 satır; satır yüksekliği takım sayısına
 * göre). Eleme: logo + ad → rakip logosu + adı + sıra. Lig aşaması: takım başına kompakt satır — rakip
 * logoları yan yana, altında ev / uçak ikonu + EV / DEP. Satırlar arasında yalnızca ince çizgi.
 */

/** Kısa yer etiketi. Not: Satori tek başına "İÇ"/"İ" dizgesini küçük harf gibi çiziyor ("İÇ SAHA" doğru) — "EV" kullanılır. */
const VENUE_SHORT = { HOME: "EV", AWAY: "DEP" } as const;

function Row({ row, card, width, height, k, only }: { row: DrawTurkishRow; card: DrawCard; width: number; height: number; k: number; only: BlockFilter }) {
  const names = { opacity: layerOpacity(only, "draw-names") };
  const lines = { opacity: layerOpacity(only, "draw-lines") };
  const leftWidth = Math.round(width * 0.36);
  const rightWidth = width - leftWidth - px(24, k);
  const logo = Math.min(px(76, k), Math.round(height * 0.5));
  const nameSize = fitFontSize(row.team.name, leftWidth - logo - px(16, k), px(44, k), 0.47, px(18, k));
  const knockout = row.order !== "";
  const opponentSize = fitFontSize(row.opponents[0]?.team.name ?? "", rightWidth - logo - px(16, k), px(44, k), 0.47, px(18, k));
  const count = row.opponents.length;
  const slot = Math.floor(rightWidth / Math.max(1, count));
  const small = Math.min(px(58, k), slot - px(10, k), Math.round(height * 0.42));
  // Logo altındaki etiket en küçük formatta da okunur: en az 12 px; "DEP" + ikon yuvaya sığar.
  const venueSize = Math.max(12, Math.min(px(15, k), Math.floor((slot - px(6, k)) / (3 * 0.84 + VENUE_ICON_EM))));
  return (
    <div tw="flex items-center" style={{ width, height, borderTop: `1px solid rgba(255,255,255,0.12)` }}>
      <div tw="flex items-center" style={{ width: leftWidth }}>
        <div tw="flex" style={names}>
          <TeamLogo src={row.team.logo} name={row.team.name} size={logo} />
        </div>
        <div tw="flex flex-col" style={{ marginLeft: px(16, k) }}>
          {row.tag ? <div tw="flex" style={lines}><Caps text={row.tag} size={px(14, k)} color={card.accentHex} weight={900} /></div> : null}
          {/* Turnuva etiketiyle ad arasında İ noktası (≈ 0,13 em) için pay. */}
          <span style={{ fontFamily: DISPLAY, fontSize: nameSize, lineHeight: 1, color: "#fff", marginTop: row.tag ? Math.ceil(nameSize * DISPLAY_ACCENT_EM) + px(8, k) : 0, ...names }}>{row.team.name}</span>
        </div>
      </div>
      <div tw="flex" style={{ width: px(24, k) }} />
      {knockout ? (
        <div tw="flex items-center" style={{ width: rightWidth }}>
          <div tw="flex" style={names}>
            <TeamLogo src={row.opponents[0]?.team.logo ?? null} name={row.opponents[0]?.team.name ?? ""} size={logo} />
          </div>
          <div tw="flex flex-col" style={{ marginLeft: px(16, k) }}>
            <span style={{ fontFamily: DISPLAY, fontSize: opponentSize, lineHeight: 1, color: "#fff", ...names }}>{row.opponents[0]?.team.name ?? ""}</span>
            {/* Sıra satırı adın Ç/Ş/Ğ kuyruğunun altından başlar. */}
            <div tw="flex" style={{ marginTop: Math.ceil(opponentSize * DISPLAY_DESCENT_EM) + px(8, k), ...lines }}><Caps text={row.order} size={px(15, k)} color={card.accentHex} weight={900} /></div>
          </div>
        </div>
      ) : (
        <div tw="flex items-center" style={{ width: rightWidth }}>
          {row.opponents.map((opponent) => (
            <div key={opponent.team.id} tw="flex flex-col items-center" style={{ width: slot }}>
              <div tw="flex" style={names}>
                <TeamLogo src={opponent.team.logo} name={opponent.team.name} size={small} />
              </div>
              <div tw="flex" style={{ marginTop: px(8, k), ...lines }}><VenueTag venue={opponent.venue} text={VENUE_SHORT[opponent.venue]} size={venueSize} color={opponent.venue === "HOME" ? card.accentHex : MUTED} spacing={0.12} /></div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function DrawTurkishTemplate({ card, body, g, only }: { card: DrawCard; body: DrawTurkishCard; g: DrawListGeometry; only?: BlockFilter }) {
  const { k } = g;
  const s = DRAW_SIZES;
  const width = g.box.right - g.box.left;
  const rowHeight = Math.min(Math.floor(g.body.height / Math.max(1, body.rows.length)), px(230, k));
  return (
    <div tw="relative flex h-full w-full" style={{ fontFamily: BODY, color: MUTED }}>
      <SetHeader card={{ pageLabel: card.pageLabels[0], dateLabel: card.dateLabel, accentHex: card.accentHex }} box={g.box} k={k} only={only} />
      <ListTitle title={body.title} subtitle={body.subtitle} accent={card.accentHex} g={g} only={only} />
      <div tw="absolute flex flex-col" style={{ left: g.box.left, top: g.body.top, width, opacity: blockOpacity(only, "draw-list", DRAW_LIST_LAYERS) }}>
        {body.rows.map((row) => (
          <Row key={`${row.tag}-${row.team.id}`} row={row} card={card} width={width} height={rowHeight} k={k} only={only} />
        ))}
      </div>
      <SetFooter card={{ competitionLabel: card.footerLine, roundLabel: "", brandLogo: card.brandLogo }} box={g.box} size={px(s.footerSize, k)} logoHeight={px(s.logoHeight, k)} only={only} />
    </div>
  );
}
