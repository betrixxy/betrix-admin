import type { ReactNode } from "react";
import type { SetCard } from "@/types/checkmatch-set";
import type { ScorerLine } from "@/types/match-result";
import { BRAND_LOGO_ALT, brandLogoWidth } from "../brand";
import { blockOpacity, type BlockFilter } from "./blocks";
import { BODY, DISPLAY, TeamLogo, fitFontSize, px } from "../match-day/shared";

/**
 * "CheckMatch set" ortak yapı taşları (Satori) — Maç Sonucu (01), İstatistikler (02) ve Detay (03)
 * AYNI kodu kullanır: skor şeridi + golcüler bloğu her kartta aynı boyut ve aynı konumda durur,
 * carousel kaydırılınca yerinden oynamaz. Konum Maç Sonucu'ndaki yerleşimdir (alttan sabitlenmiş
 * blok); başlık yuvası (MAÇIN OYUNCUSU / öne çıkan satır) sabit yüksekliktedir ki şerit kaymasın.
 * Kurallar: skor kartın en büyük metni, tek vurgu rengi (`card.accentHex`), marka sağ altta.
 */

/** İçerik kutusu — `ResultGeometry` ve `StatsGeometry` bu şekle uyar. */
export interface SetBox {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

const LOSER_ALPHA = 0.5;

/** "#ff6b00", 0.45 → "rgba(255,107,0,0.45)" */
export function hexAlpha(hex: string, alpha: number): string {
  const value = Number.parseInt(hex.replace("#", ""), 16);
  return `rgba(${(value >> 16) & 255},${(value >> 8) & 255},${value & 255},${alpha})`;
}

/** Dikey set ölçüleri (k ile ölçeklenir) — iki kart da bu sayıları okur. */
export const SET_VERTICAL = {
  headlineSlot: 32,
  headlineGap: 22,
  scoreSize: 196,
  badge: 92,
  scorerGap: 8,
  scorerSize: 24,
  scorerColumnGap: 124,
  // Künye ≥ %40 büyütüldü (16 → 23, 2026-10-18 geri bildirimi).
  footerSize: 23,
  logoHeight: 34,
  footerGap: 34,
} as const;

/** Set bloğunun alt kenarı (y) — Maç Sonucu ve İstatistik kartında aynı. */
export function setBlockBottom(box: SetBox, k: number): number {
  return box.bottom - px(SET_VERTICAL.logoHeight, k) - px(SET_VERTICAL.footerGap, k);
}

/** Top ikonu — gol satırı başında. Beyaz kontur + merkez beşgen; vurgu rengi kullanmaz. */
export function BallIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10.6" fill="white" />
      <path d="M12 7.2l4.1 3-1.6 4.8H9.5L7.9 10.2z" fill="#111" />
      <path d="M12 1.4v5.8M16.1 10.2l5.3-1.8M14.5 15l3.3 4.6M9.5 15l-3.3 4.6M7.9 10.2L2.6 8.4" stroke="#111" strokeWidth="1.3" fill="none" />
    </svg>
  );
}

function ScoreDigit({ value, size, dim }: { value: number; size: number; dim: boolean }) {
  return (
    <span style={{ fontFamily: DISPLAY, fontSize: size, lineHeight: 1, color: dim ? `rgba(255,255,255,${LOSER_ALPHA})` : "white" }}>
      {String(value)}
    </span>
  );
}

function TeamColumn({ name, logo, width, logoSize, nameSize }: { name: string; logo: string | null; width: number; logoSize: number; nameSize: number }) {
  return (
    <div tw="flex flex-col items-center" style={{ width }}>
      <TeamLogo src={logo} name={name} size={logoSize} />
      <span
        style={{
          fontFamily: DISPLAY,
          fontSize: fitFontSize(name, width, nameSize, 0.5, 18),
          lineHeight: 1,
          letterSpacing: 1,
          color: "white",
          marginTop: Math.round(logoSize * 0.18),
        }}
      >
        {name}
      </span>
    </div>
  );
}

/** Skor şeridi: logo+ad · skor · turnuva rozeti · skor · logo+ad. Kaybedenin skoru soluk. */
export function ScoreStrip({ card, k, scoreSize }: { card: SetCard; k: number; scoreSize: number }) {
  const dimHome = card.outcome === "AWAY";
  const dimAway = card.outcome === "HOME";
  const column = px(250, k);
  const center = px(124, k);
  const badge = px(SET_VERTICAL.badge, k);
  return (
    <div tw="flex items-center justify-center">
      <TeamColumn name={card.homeTeam} logo={card.homeLogo} width={column} logoSize={px(92, k)} nameSize={px(36, k)} />
      <div tw="flex justify-center" style={{ width: px(132, k) }}>
        <ScoreDigit value={card.homeGoals} size={scoreSize} dim={dimHome} />
      </div>
      <div tw="flex flex-col items-center justify-center" style={{ width: center }}>
        {card.leagueLogo ? (
          // Şeffaf rozet: beyaz kutu yok — vurgu renginde 2px halka + hafif ışıma.
          <div
            tw="flex items-center justify-center"
            style={{
              width: badge,
              height: badge,
              borderRadius: badge / 2,
              border: `2px solid ${card.accentHex}`,
              boxShadow: `0 0 ${px(22, k)}px ${hexAlpha(card.accentHex, 0.45)}, inset 0 0 ${px(14, k)}px ${hexAlpha(card.accentHex, 0.25)}`,
              backgroundColor: "rgba(7,8,12,0.35)",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- Satori yalnızca düz <img> okur. */}
            <img src={card.leagueLogo} alt="" width={px(58, k)} height={px(58, k)} style={{ objectFit: "contain" }} />
          </div>
        ) : (
          <div tw="flex" style={{ width: px(28, k), height: px(6, k), backgroundColor: card.accentHex }} />
        )}
        {card.penaltyLabel ? (
          <span style={{ fontFamily: BODY, fontWeight: 700, fontSize: px(18, k), letterSpacing: 2, color: card.accentHex, marginTop: px(12, k) }}>
            {card.penaltyLabel}
          </span>
        ) : null}
      </div>
      <div tw="flex justify-center" style={{ width: px(132, k) }}>
        <ScoreDigit value={card.awayGoals} size={scoreSize} dim={dimAway} />
      </div>
      <TeamColumn name={card.awayTeam} logo={card.awayLogo} width={column} logoSize={px(92, k)} nameSize={px(36, k)} />
    </div>
  );
}

/** Ev sahibi satırı aynalanır (isim · dakika · top): ikonlar iki sütunda da dış kenarda hizalı kalır. */
function ScorerRow({ line, size, accent, align }: { line: ScorerLine; size: number; accent: string; align: "left" | "right" }) {
  const gap = size * 0.45;
  const icon = <BallIcon size={Math.round(size * 0.92)} />;
  return (
    <div tw="flex items-center" style={{ marginTop: size * 0.5 }}>
      {align === "left" ? icon : null}
      <span style={{ fontFamily: BODY, fontWeight: 700, fontSize: size, color: "white", marginLeft: align === "left" ? gap : 0, letterSpacing: 0.5 }}>
        {line.name}
      </span>
      <span style={{ fontFamily: BODY, fontWeight: 900, fontSize: size, color: accent, margin: `0 ${align === "right" ? gap : 0}px 0 ${gap}px` }}>
        {line.minutes.join(", ")}
      </span>
      {align === "right" ? icon : null}
    </div>
  );
}

/** İki sütun golcü listesi — ev sahibi sağa (merkeze), deplasman sola (merkeze) yaslı. */
/** Büyük harf Geist Bold'un ortalama glif genişliği (em) ve satırdaki sabit paylar (ikon + iki boşluk). */
const SCORER_EM_PER_CHAR = 0.7;
const SCORER_FIXED_EM = 0.92 + 0.45 * 2;

/**
 * Golcü yazı boyutu: en uzun satır ("İRFAN CAN EĞRİBAYAT 88' (KK)") sütununa sığana kadar küçültülür
 * — iki sütun aynı boyutu kullanır. Yerleşim kontrolü taşmayı ayrıca denetler.
 */
export function scorerFontSize(lines: ScorerLine[], columnWidth: number, size: number): number {
  const longest = Math.max(0, ...lines.map((line) => line.name.length + line.minutes.join(", ").length));
  if (longest === 0) return size;
  return Math.min(size, Math.floor(columnWidth / (SCORER_FIXED_EM + longest * SCORER_EM_PER_CHAR)));
}

export function ScorerColumns({ card, width, size: maxSize, gap }: { card: SetCard; width: number; size: number; gap: number }) {
  const columnWidth = (width - gap) / 2;
  const size = scorerFontSize([...card.homeScorers, ...card.awayScorers], columnWidth, maxSize);
  const column = (lines: ScorerLine[], align: "left" | "right") => (
    <div tw="flex flex-col" style={{ width: columnWidth, alignItems: align === "right" ? "flex-end" : "flex-start" }}>
      {lines.map((line) => (
        <ScorerRow key={`${line.playerId ?? line.name}-${line.minutes[0] ?? ""}`} line={line} size={size} accent={card.accentHex} align={align} />
      ))}
    </div>
  );
  return (
    <div tw="flex" style={{ width }}>
      {column(card.homeScorers, "right")}
      <div tw="flex" style={{ width: gap }} />
      {column(card.awayScorers, "left")}
    </div>
  );
}

/**
 * Dikey set bloğu: başlık yuvası · skor şeridi · golcüler — alttan `setBlockBottom`'a sabitli.
 * `spineHex` verilirse başlık yuvasının altından turnuva rozetinin üst kenarına inen ince çizgi
 * (İstatistik kartının omurgasının son parçası) çizilir; Maç Sonucu'nda yoktur.
 */
export function SetScoreBlock({
  card,
  box,
  frameHeight,
  k,
  headline,
  spineHex,
  only,
}: {
  card: SetCard;
  box: SetBox;
  frameHeight: number;
  k: number;
  headline: ReactNode;
  spineHex?: string | null;
  only?: BlockFilter;
}) {
  const width = box.right - box.left;
  const v = SET_VERTICAL;
  const scoreSize = px(v.scoreSize, k);
  const centerHeight = px(v.badge, k) + (card.penaltyLabel ? px(12 + 22, k) : 0);
  const spineTop = px(v.headlineSlot, k);
  const spineHeight = px(v.headlineGap, k) + Math.max(0, Math.round((scoreSize - centerHeight) / 2));
  return (
    <div tw="absolute flex flex-col items-center" style={{ left: box.left, width, bottom: frameHeight - setBlockBottom(box, k) }}>
      {spineHex ? (
        <div tw="absolute flex" style={{ left: width / 2 - 1, top: spineTop, width: 2, height: spineHeight, backgroundColor: spineHex, opacity: only ? 0 : 1 }} />
      ) : null}
      <div tw="flex items-center justify-center" style={{ height: px(v.headlineSlot, k), opacity: blockOpacity(only, "headline") }}>
        {headline}
      </div>
      <div tw="flex" style={{ marginTop: px(v.headlineGap, k), opacity: blockOpacity(only, "strip") }}>
        <ScoreStrip card={card} k={k} scoreSize={scoreSize} />
      </div>
      <div tw="flex" style={{ marginTop: px(v.scorerGap, k), opacity: blockOpacity(only, "scorers") }}>
        <ScorerColumns card={card} width={width} size={px(v.scorerSize, k)} gap={px(v.scorerColumnGap, k)} />
      </div>
    </div>
  );
}

const HEADER_SHADOW = "0 2px 12px rgba(0,0,0,0.6)";

/**
 * Üst satır: solda sayfa etiketi ("01" vurgu renginde, "· MAÇ SONUCU" beyaz — kart tek başına
 * paylaşılırken çizilmez), sağda simetrik maç tarihi ("23.07.2026", aynı stil).
 */
export function SetHeader({ card, box, k, only }: { card: Pick<SetCard, "pageLabel" | "dateLabel" | "accentHex">; box: SetBox; k: number; only?: BlockFilter }) {
  const size = px(18, k);
  const text = { fontFamily: BODY, fontWeight: 700, fontSize: size, lineHeight: 1, letterSpacing: size * 0.24, color: "rgba(255,255,255,0.88)", textShadow: HEADER_SHADOW };
  const [number, ...rest] = card.pageLabel?.split(" · ") ?? [];
  return (
    <div tw="absolute flex items-center justify-between" style={{ left: box.left, top: box.top, width: box.right - box.left, height: size }}>
      {card.pageLabel ? (
        <div tw="flex items-center" style={{ opacity: blockOpacity(only, "header-label") }}>
          <span style={{ ...text, fontWeight: 900, letterSpacing: size * 0.12, color: card.accentHex }}>{number}</span>
          <div tw="flex" style={{ width: px(22, k), height: 2, backgroundColor: "rgba(255,255,255,0.55)", margin: `0 ${px(12, k)}px` }} />
          <span style={text}>{rest.join(" · ")}</span>
        </div>
      ) : (
        <div tw="flex" />
      )}
      <span style={{ ...text, opacity: blockOpacity(only, "header-date") }}>{card.dateLabel}</span>
    </div>
  );
}

/** Künye harf aralığı (em) ve büyük harf Geist Bold'un ortalama glif genişliği (em) — sığdırma tahmini. */
const FOOTER_TRACKING = 0.12;
const FOOTER_EM_PER_CHAR = 0.7 + FOOTER_TRACKING;
const FOOTER_LOGO_GAP = 28;

export const footerLine = (card: Pick<SetCard, "competitionLabel" | "roundLabel">) => [card.competitionLabel, card.roundLabel].filter(Boolean).join("  ·  ");

/** Künye yazı boyutu: istenen boyut, logoya çarpacaksa satır sığana kadar küçültülür. */
export function footerFontSize(line: string, boxWidth: number, size: number, logoHeight: number): number {
  const available = boxWidth - brandLogoWidth(logoHeight) - FOOTER_LOGO_GAP;
  return Math.min(size, Math.floor(available / Math.max(1, line.length * FOOTER_EM_PER_CHAR)));
}

/**
 * Künye (sol: resmi turnuva adı · tur, %85 beyaz) + CheckMatch logosu (sağ alt köşe, tüm set
 * kartlarında aynı yer). Uzun turnuva/tur adı logoya çarpmasın diye boyut sığdırılır.
 */
export function SetFooter({ card, box, size, logoHeight, only }: { card: Pick<SetCard, "competitionLabel" | "roundLabel" | "brandLogo">; box: SetBox; size: number; logoHeight: number; only?: BlockFilter }) {
  const line = footerLine(card);
  const fontSize = footerFontSize(line, box.right - box.left, size, logoHeight);
  return (
    <div tw="absolute flex items-center justify-between" style={{ left: box.left, width: box.right - box.left, top: box.bottom - logoHeight, height: logoHeight }}>
      <span style={{ fontFamily: BODY, fontWeight: 700, fontSize, letterSpacing: fontSize * FOOTER_TRACKING, color: "rgba(255,255,255,0.85)", opacity: blockOpacity(only, "footer-text") }}>{line}</span>
      {/* eslint-disable-next-line @next/next/no-img-element -- Satori yalnızca düz <img> okur. */}
      <img src={card.brandLogo} alt={BRAND_LOGO_ALT} width={brandLogoWidth(logoHeight)} height={logoHeight} style={{ opacity: blockOpacity(only, "footer-logo") }} />
    </div>
  );
}
