import type { MatchDayFrame } from "@/lib/dashboard/match-day-formats";
import type { MatchDayTemplateId } from "@/types/match-day";

/**
 * Şablon × format geometrisi — TEK KAYNAK. Satori şablonları (yazı konumları) ve sharp
 * kompozisyonu (oyuncu yerleşimi, gölgeler) aynı sayıları buradan okur; böylece metin ve
 * oyuncu yüzleri hiçbir formatta çakışmaz. Dikey formatlar `k` ölçeğiyle küçülür (1:1),
 * Story'de platform arayüzü bantları (`safeTop`/`safeBottom`) boş bırakılır.
 */

export interface PlayerSlot {
  centerX: number;
  /** Oyuncular üstten hizalanır: yüzler fotoğraf oranından bağımsız aynı yükseklikte kalır. */
  top: number;
  maxWidth: number;
  maxHeight: number;
}

export interface TemplateGeometry {
  frame: MatchDayFrame;
  /** Dikey formatlarda tipografi ölçeği (4:5 ve 9:16 = 1, 1:1 = 0.8); yatayda 1. */
  k: number;
  /** İçerik kutusu — güvenli alan + kenar boşlukları düşülmüş. */
  top: number;
  bottom: number;
  left: number;
  right: number;
  home: PlayerSlot;
  away: PlayerSlot;
  /** Alt metin bloğunun başladığı y — gölge geçişi buradan önce başlar. */
  blockTop: number;
}

function verticalBox(frame: MatchDayFrame) {
  const k = Math.min(1, frame.height / 1350);
  return {
    k,
    top: frame.safeTop + Math.round(52 * k),
    bottom: frame.height - frame.safeBottom - Math.round(44 * k),
    left: 56,
    right: frame.width - 56,
  };
}

function premiumBroadcast(frame: MatchDayFrame): TemplateGeometry {
  if (frame.orientation === "landscape") {
    return {
      frame, k: 1, top: 40, bottom: frame.height - 36, left: 48, right: frame.width - 48,
      home: { centerX: 790, top: 40, maxWidth: 400, maxHeight: 760 },
      away: { centerX: 1030, top: 40, maxWidth: 400, maxHeight: 760 },
      blockTop: 330,
    };
  }
  const box = verticalBox(frame);
  const { k } = box;
  // Alt blok: MAÇ GÜNÜ başlığı + logolar + isimler + künye satırı + marka.
  const blockTop = box.bottom - Math.round(470 * k);
  const playersTop = box.top + Math.round(126 * k);
  const slot = (dir: -1 | 1): PlayerSlot => ({
    centerX: frame.width / 2 + dir * Math.round(205 * k),
    top: playersTop,
    maxWidth: Math.round(560 * k),
    // Oyuncuların bel kısmı başlığın arkasına girer (referans yayın grafiklerindeki gibi).
    maxHeight: blockTop + Math.round(150 * k) - playersTop,
  });
  return { frame, ...box, home: slot(-1), away: slot(1), blockTop };
}

function dataDriven(frame: MatchDayFrame): TemplateGeometry {
  if (frame.orientation === "landscape") {
    return {
      frame, k: 1, top: 40, bottom: frame.height - 36, left: 48, right: frame.width - 48,
      // Oyuncular orta kolonda (x ≈ 430-860); sağdaki istatistik kolonu (x ≥ 880) boş kalır.
      home: { centerX: 570, top: 70, maxWidth: 280, maxHeight: 620 },
      away: { centerX: 720, top: 110, maxWidth: 280, maxHeight: 620 },
      blockTop: 470,
    };
  }
  const box = verticalBox(frame);
  const { k } = box;
  // Alt bant: istatistik kutuları; sol kolon: başlık + tarih bloğu; oyuncular sağ kolonda.
  const blockTop = box.bottom - Math.round(300 * k);
  const playersTop = box.top + Math.round(150 * k);
  const maxHeight = blockTop - Math.round(10 * k) - playersTop;
  return {
    frame,
    ...box,
    home: { centerX: Math.round(frame.width * 0.66), top: playersTop, maxWidth: Math.round(380 * k), maxHeight },
    away: { centerX: Math.round(frame.width * 0.86), top: playersTop + Math.round(40 * k), maxWidth: Math.round(380 * k), maxHeight },
    blockTop,
  };
}

function editorialPortrait(frame: MatchDayFrame): TemplateGeometry {
  if (frame.orientation === "landscape") {
    return {
      frame, k: 1, top: 40, bottom: frame.height - 36, left: 48, right: frame.width - 48,
      home: { centerX: 300, top: 50, maxWidth: 420, maxHeight: 760 },
      away: { centerX: 520, top: 50, maxWidth: 420, maxHeight: 760 },
      blockTop: 300,
    };
  }
  const box = verticalBox(frame);
  const { k } = box;
  // Alt blok: serif takım adları (kademeli) + künye satırı + marka.
  const blockTop = box.bottom - Math.round(400 * k);
  const playersTop = box.top + Math.round(70 * k);
  const slot = (dir: -1 | 1): PlayerSlot => ({
    centerX: frame.width / 2 + dir * Math.round(170 * k),
    top: playersTop,
    maxWidth: Math.round(600 * k),
    maxHeight: blockTop + Math.round(140 * k) - playersTop,
  });
  return { frame, ...box, home: slot(-1), away: slot(1), blockTop };
}

export function matchDayGeometry(template: MatchDayTemplateId, frame: MatchDayFrame): TemplateGeometry {
  switch (template) {
    case "PREMIUM_BROADCAST":
      return premiumBroadcast(frame);
    case "DATA_DRIVEN":
      return dataDriven(frame);
    case "EDITORIAL_PORTRAIT":
      return editorialPortrait(frame);
  }
}
