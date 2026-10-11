import { formationGroups } from "@/lib/dashboard/lineup-formations";
import type { LineupPalette, LineupSlot, SquadPosition } from "@/types/lineup";
import { EYEBROW, SCORE, TEAM, rgba, upper } from "../deep-analysis/deep-analysis-tokens";
import { CONTENT_BOTTOM, CONTENT_TOP, H, LineupBackground, W, displayName } from "./lineup-chrome";

/**
 * ŞABLON 2 — Kahraman Liste (`hero_list`). Kapak ZORUNLUDUR: kapaksız liste kartı çizilmez (render
 * tarafı taktik tahtasına düşer). Sol yarıda kapak oyuncusunun şeffaf kesimi (alttan taşar), sağda saha
 * çizgisi OLMAYAN liste: logonun canlı renginde numara kutusu + isim + mevki, mevkiler arası vurgu
 * renginde ayraç. Liste koyu cam panel üstündedir — kapak arkada kalsa da beyaz metin kontrastı korunur.
 */

export interface LineupHeroImage {
  /** Kırpılmış (boş kenarları atılmış) şeffaf PNG, data URL. */
  src: string;
  width: number;
  height: number;
}

const PANEL_TOP = CONTENT_TOP - 10;
const PANEL_HEIGHT = CONTENT_BOTTOM - PANEL_TOP;
const PANEL = { left: 540, width: 490 } as const;
const PANEL_PAD_X = 28;
const PANEL_PAD_Y = 22;
const ROW_HEIGHT = 58;
const GROUP_GAP = 19;
const NUMBER_BOX = 50;
const ROLE_WIDTH = 52;
const ROW_GAP = 18;
const NAME_MAX_FONT = 31;
const NAME_MIN_FONT = 22;
/** Bricolage ExtraBold büyük harfte ortalama karakter genişliği / font boyutu. */
const CHAR_WIDTH_RATIO = 0.68;
const MAX_NAME_CHARS = 16;
/** Kapak sol yarıda bu merkeze oturur. */
const HERO_CENTER_X = 280;

const ROLE_TAGS: Record<SquadPosition, string> = { G: "KL", D: "DEF", M: "OS", F: "FV" };

/** Liste için tek ortak isim boyutu: en uzun isme göre, alt sınırla (uzun tek ad üç noktayla kısalır). */
function listFontSize(names: string[], nameWidth: number): number {
  const fits = names.filter(Boolean).map((name) => Math.floor(nameWidth / (name.length * CHAR_WIDTH_RATIO)));
  return Math.max(NAME_MIN_FONT, Math.min(NAME_MAX_FONT, ...fits));
}

function PlayerRow({ slot, name, role, fontSize, goalkeeper, palette, divider }: { slot: LineupSlot; name: string; role: string; fontSize: number; goalkeeper: boolean; palette: LineupPalette; divider: boolean }) {
  const [fill, ink] = goalkeeper ? [palette.keeper, palette.keeperText] : [palette.kit, palette.kitText];
  return (
    <div tw="flex items-center" style={{ height: ROW_HEIGHT, gap: ROW_GAP, borderTop: divider ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(255,255,255,0)" }}>
      <div
        tw="flex items-center justify-center"
        style={{ width: NUMBER_BOX, height: NUMBER_BOX, borderRadius: 12, backgroundColor: fill, border: `2px solid ${rgba(palette.text, 0.85)}`, boxShadow: "0 6px 16px rgba(0,0,0,0.45)" }}
      >
        <span style={{ fontFamily: SCORE, fontSize: slot.number.length > 1 ? 22 : 25, color: ink, lineHeight: 1 }}>{slot.number || "·"}</span>
      </div>
      <span tw="flex-1" style={{ fontFamily: TEAM, fontWeight: 800, fontSize, letterSpacing: 0.6, color: palette.text, lineHeight: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {name}
      </span>
      <span style={{ width: ROLE_WIDTH, fontFamily: EYEBROW, fontWeight: 700, fontSize: 14, letterSpacing: 2, color: palette.muted, textAlign: "right" }}>{role}</span>
    </div>
  );
}

export function LineupHeroList({ formation, slots, palette, hero }: { formation: string; slots: LineupSlot[]; palette: LineupPalette; hero: LineupHeroImage }) {
  const night = palette.backgroundBottom;
  const nameWidth = PANEL.width - PANEL_PAD_X * 2 - NUMBER_BOX - ROLE_WIDTH - ROW_GAP * 2;
  const names = slots.map((slot) => upper(displayName(slot.name, MAX_NAME_CHARS)));
  const fontSize = listFontSize(names, nameWidth);
  const groups = formationGroups(formation);
  // Satırlar ve mevki ayraçları dikeyde ortalanır.
  const listHeight = slots.length * ROW_HEIGHT + (groups.length - 1) * GROUP_GAP;
  const listTop = Math.max(PANEL_PAD_Y, Math.round((PANEL_HEIGHT - listHeight) / 2));
  const heroLeft = Math.round(Math.max(-60, HERO_CENTER_X - hero.width / 2));

  return (
    <>
      <LineupBackground palette={palette} glow={{ left: 0, top: 300, size: 760 }} />
      {/* eslint-disable-next-line @next/next/no-img-element -- Satori yalnızca düz <img> okur. */}
      <img src={hero.src} alt="" width={hero.width} height={hero.height} style={{ position: "absolute", left: heroLeft, bottom: 0 }} />
      {/* Okunabilirlik perdesi: kapağın sağ kenarı listenin arkasında yumuşar. */}
      <div style={{ position: "absolute", left: 0, top: 0, width: W, height: H, backgroundImage: `linear-gradient(90deg, ${rgba(night, 0)} 38%, ${rgba(night, 0.5)} 52%, ${rgba(night, 0.7)} 100%)` }} />

      <div
        tw="flex flex-col"
        style={{
          position: "absolute",
          left: PANEL.left,
          top: PANEL_TOP,
          width: PANEL.width,
          height: PANEL_HEIGHT,
          padding: `${listTop}px ${PANEL_PAD_X}px 0`,
          borderRadius: 28,
          backgroundImage: `linear-gradient(180deg, ${rgba(night, 0.74)} 0%, ${rgba(night, 0.6)} 100%)`,
          border: `1px solid ${rgba(palette.accent, 0.18)}`,
          boxShadow: "0 30px 60px rgba(0,0,0,0.45)",
        }}
      >
        {groups.map((group, groupIndex) => (
          <div
            key={group.role}
            tw="flex flex-col"
            style={{
              marginTop: groupIndex === 0 ? 0 : Math.floor(GROUP_GAP / 2),
              paddingTop: groupIndex === 0 ? 0 : Math.ceil(GROUP_GAP / 2) - 2,
              borderTop: groupIndex === 0 ? "none" : `2px solid ${rgba(palette.accent, 0.5)}`,
            }}
          >
            {group.indexes.map((slotIndex, rowIndex) => {
              const slot = slots[slotIndex];
              if (!slot) return null;
              return (
                <PlayerRow
                  key={slotIndex}
                  slot={slot}
                  name={names[slotIndex] ?? ""}
                  role={ROLE_TAGS[group.role]}
                  fontSize={fontSize}
                  goalkeeper={slotIndex === 0}
                  palette={palette}
                  divider={rowIndex > 0}
                />
              );
            })}
          </div>
        ))}
      </div>
    </>
  );
}
