import { formationGroups } from "@/lib/dashboard/lineup-formations";
import type { LineupPalette, LineupSlot, SquadPosition } from "@/types/lineup";
import { upperName, type NameOrigin } from "@/lib/dashboard/name-case";
import { rgba } from "../studio-tokens";
import type { BlockFilter } from "../checkmatch-set/blocks";
import { TYPE, displayName, labelStyle, nameStyle, shown } from "./lineup-chrome";
import type { LineupGeometry } from "./lineup-geometry";

/**
 * ŞABLON 2 — Kahraman Liste (`hero_list`). Kapak ZORUNLUDUR: kapaksız liste kartı çizilmez (render
 * tarafı taktik tahtasına düşer). Kapak fotoğrafı bu katmanda DEĞİL — altındaki sanat katmanındadır
 * (`lib/dashboard/lineup-hero-art.ts`: arşiv fotoğrafı, yüz tespiti, akıllı kırpma, tonlama); bu katman
 * saydamdır ve yalnızca saha çizgisi OLMAYAN listeyi çizer: logonun canlı renginde numara kutusu + isim +
 * mevki, mevkiler arası vurgu renginde ayraç. Liste koyu cam panel üstündedir — fotoğraf arkada kalsa da
 * beyaz metin kontrastı korunur.
 */

/** 4:5 ölçüleri; diğer formatlarda `LineupGeometry.k` ile ölçeklenir, panel ve kapak konumu geometriden gelir. */
const PANEL_PAD_X = 28;
const PANEL_PAD_Y = 22;
const ROW_HEIGHT = 58;
const GROUP_GAP = 19;
const NUMBER_BOX = 50;
const ROLE_WIDTH = 52;
const ROW_GAP = 18;
const NAME_MAX_FONT = 29;
const NAME_MIN_FONT = 22;
/** Manrope büyük harfte ortalama karakter genişliği / font boyutu (+ ad-soyad boşluğu payı). */
const CHAR_WIDTH_RATIO = 0.72;
const MAX_NAME_CHARS = 16;

const ROLE_TAGS: Record<SquadPosition, string> = { G: "KL", D: "DEF", M: "OS", F: "FV" };

/** Liste için tek ortak isim boyutu: en uzun isme göre, alt sınırla (uzun tek ad üç noktayla kısalır). */
function listFontSize(names: string[], nameWidth: number, k: number): number {
  const fits = names.filter(Boolean).map((name) => Math.floor(nameWidth / (name.length * CHAR_WIDTH_RATIO)));
  return Math.max(Math.round(NAME_MIN_FONT * k), Math.min(Math.round(NAME_MAX_FONT * k), ...fits));
}

function PlayerRow({ slot, name, role, fontSize, goalkeeper, palette, divider, k }: { slot: LineupSlot; name: string; role: string; fontSize: number; goalkeeper: boolean; palette: LineupPalette; divider: boolean; k: number }) {
  const box = Math.round(NUMBER_BOX * k);
  const words = name.split(" ");
  const last = words.pop() ?? "";
  const first = words.join(" ");
  const [fill, ink] = goalkeeper ? [palette.keeper, palette.keeperText] : [palette.kit, palette.kitText];
  return (
    <div tw="flex items-center" style={{ height: Math.round(ROW_HEIGHT * k), gap: Math.round(ROW_GAP * k), borderTop: divider ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(255,255,255,0)" }}>
      <div
        tw="flex items-center justify-center"
        style={{ width: box, height: box, borderRadius: Math.round(12 * k), backgroundColor: fill, border: `2px solid ${rgba(palette.text, 0.85)}`, boxShadow: "0 6px 16px rgba(0,0,0,0.45)" }}
      >
        <span style={{ fontFamily: TYPE.DISPLAY, fontSize: Math.round((slot.number.length > 1 ? 22 : 25) * k), color: ink, lineHeight: 1, letterSpacing: -0.5 }}>{slot.number || "·"}</span>
      </div>
      {/* Dergi düzeni: ad ince ve soluk, soyadı kalın ve parlak — aynı satırda. */}
      <div tw="flex flex-1 items-baseline" style={{ gap: Math.round(fontSize * 0.3), overflow: "hidden" }}>
        {first ? <span style={{ ...nameStyle(fontSize, rgba(palette.text, 0.7), 500), whiteSpace: "nowrap" }}>{first}</span> : null}
        <span style={{ ...nameStyle(fontSize, palette.text), whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{last}</span>
      </div>
      <span style={{ ...labelStyle(Math.round(13 * k), palette.muted), width: Math.round(ROLE_WIDTH * k), textAlign: "right" }}>{role}</span>
    </div>
  );
}

/** `peopleOrigin`: oyuncu adlarının varsayılan kökeni (takımın ülkesi, bkz. name-case.ts). */
export function LineupHeroList({
  g,
  formation,
  slots,
  palette,
  peopleOrigin = null,
  only,
}: {
  g: LineupGeometry;
  formation: string;
  slots: LineupSlot[];
  palette: LineupPalette;
  peopleOrigin?: NameOrigin | null;
  only?: BlockFilter;
}) {
  const { k, panel } = g;
  const night = palette.backgroundBottom;
  const padX = Math.round(PANEL_PAD_X * k);
  const rowHeight = Math.round(ROW_HEIGHT * k);
  const groupGap = Math.round(GROUP_GAP * k);
  const nameWidth = panel.width - padX * 2 - Math.round(NUMBER_BOX * k) - Math.round(ROLE_WIDTH * k) - Math.round(ROW_GAP * k) * 2;
  const names = slots.map((slot) => upperName(displayName(slot.name, MAX_NAME_CHARS), slot.origin ?? peopleOrigin));
  const fontSize = listFontSize(names, nameWidth, k);
  const groups = formationGroups(formation);
  // Satırlar ve mevki ayraçları dikeyde ortalanır.
  const listHeight = slots.length * rowHeight + (groups.length - 1) * groupGap;
  const listTop = Math.max(Math.round(PANEL_PAD_Y * k), Math.round((panel.height - listHeight) / 2));
  return (
    <>
      <div
        tw="flex flex-col"
        style={{
          position: "absolute",
          left: panel.left,
          top: panel.top,
          width: panel.width,
          height: panel.height,
          padding: `${listTop}px ${padX}px 0`,
          borderRadius: 28,
          backgroundImage: `linear-gradient(180deg, ${rgba(night, 0.74)} 0%, ${rgba(night, 0.6)} 100%)`,
          border: `1px solid ${rgba(palette.accent, 0.18)}`,
          boxShadow: "0 30px 60px rgba(0,0,0,0.45)",
          ...shown(only, "card-body"),
        }}
      >
        {groups.map((group, groupIndex) => (
          <div
            key={group.role}
            tw="flex flex-col"
            style={{
              marginTop: groupIndex === 0 ? 0 : Math.floor(groupGap / 2),
              paddingTop: groupIndex === 0 ? 0 : Math.ceil(groupGap / 2) - 2,
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
                  k={k}
                />
              );
            })}
          </div>
        ))}
      </div>
    </>
  );
}
