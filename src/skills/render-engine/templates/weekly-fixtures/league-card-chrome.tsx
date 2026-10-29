import { LEAGUE_BADGE_PAD, type WeeklyLayout } from "@/lib/dashboard/weekly-fixtures-layout";
import { BRAND_LOGO_ALT, brandLogoWidth } from "../brand";
import { blockOpacity, type BlockFilter, type LayoutBlockId } from "../checkmatch-set/blocks";
import { EYEBROW, SCORE, TEAM, rgba, upper } from "../studio-tokens";
import type { WeeklyTheme } from "./weekly-theme";

/**
 * Lig kartlarının ortak çerçevesi (Haftanın Maçları, Puan Durumu): gece temasında neon parıltı, üstte lig
 * logosu (yayıncı grafiklerindeki gibi büyük bir mühür, kenarı formata göre `layout.leagueLogo`) + künye + büyük başlık + tür etiketi, altta CheckMatch imzalı bant. Konumlar `WeeklyLayout`ten
 * gelir (Story güvenli alanları, yatay format dahil).
 */

const BRAND_LOGO_HEIGHT = 46;

/** Lig kartlarının blokları (yerleşim kapısı) — logo dahil her öğe birine aittir; zemin, ışıma ve bant zemini ölçülmez. */
export const LEAGUE_CARD_BLOCKS = ["card-header", "card-body", "footer-text", "footer-logo"] as const satisfies readonly LayoutBlockId[];

export const shown = (only: BlockFilter, id: LayoutBlockId) => ({ opacity: blockOpacity(only, id) });

/** Büyük başlık tek satıra sığacak boyutta (Archivo Black büyük harf ≈ 0.78 em/karakter). */
function titleSize(title: string, available: number, max: number): number {
  return Math.max(48, Math.min(max, Math.floor(available / (Math.max(1, title.length) * 0.78))));
}

export function LeagueCardGlow({ layout, theme, only }: { layout: WeeklyLayout; theme: WeeklyTheme; only?: BlockFilter }) {
  if (!theme.glow || only) return null;
  return (
    <div
      style={{
        position: "absolute",
        left: Math.round(layout.width / 2 - 460),
        top: -520,
        width: 1000,
        height: 1000,
        backgroundImage: `radial-gradient(${rgba(theme.glow, 0.28)} 0%, ${rgba(theme.glow, 0)} 70.7%)`,
      }}
    />
  );
}

export function LeagueCardHeader({
  layout,
  theme,
  leagueLogoUrl,
  kicker,
  title,
  kindLabel,
  only,
}: {
  layout: WeeklyLayout;
  theme: WeeklyTheme;
  only?: BlockFilter;
  leagueLogoUrl: string;
  /** Üst künye satırı (Space Mono), ör. "SÜPER LİG · 2025/26". */
  kicker: string;
  /** Büyük başlık (Archivo Black). */
  title: string;
  /** Vurgu renginde tür etiketi, ör. "FİKSTÜR" / "8. HAFTA SONU". */
  kindLabel: string;
}) {
  const contentWidth = layout.width - layout.pad * 2;
  const logo = layout.leagueLogo;
  const badge = theme.leagueBadge ? LEAGUE_BADGE_PAD : 0;
  const textWidth = contentWidth - (leagueLogoUrl ? logo + badge + 36 : 0);
  const size = titleSize(title, textWidth, layout.titleMax);
  return (
    <div tw="flex items-center" style={{ position: "absolute", left: layout.pad, top: layout.headerTop, width: contentWidth, gap: 36, ...shown(only, "card-header") }}>
      {leagueLogoUrl ? (
        <div
          tw="flex items-center justify-center"
          style={{
            width: logo + badge,
            height: logo + badge,
            borderRadius: Math.round((logo + badge) * 0.22),
            backgroundColor: theme.leagueBadge ?? "rgba(0,0,0,0)",
            boxShadow: theme.leagueBadge ? `0 0 56px ${rgba(theme.accent, 0.4)}, 0 18px 40px rgba(0,0,0,0.35)` : "none",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- Satori yalnızca düz <img> okur. */}
          <img src={leagueLogoUrl} alt="" width={logo} height={logo} style={{ objectFit: "contain" }} />
        </div>
      ) : null}
      <div tw="flex flex-col" style={{ gap: 14, flex: 1 }}>
        <span style={{ fontFamily: EYEBROW, fontWeight: 700, fontSize: 19, letterSpacing: 4, color: theme.muted, lineHeight: 1 }}>{kicker}</span>
        <span style={{ fontFamily: SCORE, fontSize: size, lineHeight: 1, letterSpacing: Math.min(-2, -size * 0.035), color: theme.text, whiteSpace: "nowrap" }}>{title}</span>
        <div tw="flex items-center" style={{ gap: 12 }}>
          <div style={{ width: 34, height: 4, backgroundColor: theme.accent }} />
          <span style={{ fontFamily: EYEBROW, fontWeight: 700, fontSize: 17, letterSpacing: 4, color: theme.accent, lineHeight: 1 }}>{kindLabel}</span>
        </div>
      </div>
    </div>
  );
}

/** Bölüm ayracı (gün / grup): Bricolage ExtraBold, küçük punto, çok geniş harf aralığı + ince çizgi. */
export function LeagueCardDivider({ label, height, theme }: { label: string; height: number; theme: WeeklyTheme }) {
  return (
    <div tw="flex items-center" style={{ height, gap: 14 }}>
      <span style={{ fontFamily: TEAM, fontWeight: 800, fontSize: 15, letterSpacing: 5, color: theme.accent, lineHeight: 1 }}>{upper(label)}</span>
      <div style={{ flex: 1, height: 1, backgroundColor: theme.rowBorder }} />
    </div>
  );
}

/** Alt imza bandı: kanvasın altına kadar iner; içerik üstteki `footerHeight` şeridinde ortalanır (Story alt bandı boş kalır). */
export function LeagueCardFooter({ layout, theme, brandLogo, note, only }: { layout: WeeklyLayout; theme: WeeklyTheme; brandLogo: string; note: string; only?: BlockFilter }) {
  const { width: W, height: H, pad: PAD } = layout;
  return (
    <div
      tw="flex items-center justify-between"
      style={{
        position: "absolute",
        left: 0,
        top: layout.footerTop,
        width: W,
        height: H - layout.footerTop,
        padding: `0 ${PAD}px ${H - layout.footerTop - layout.footerHeight}px`,
        // Bant zemini ölçülmez (yerleşim kapısı); logo ve not ayrı bloklar.
        backgroundColor: only ? "transparent" : theme.footerBg,
        borderTop: only ? "2px solid transparent" : `2px solid ${theme.mode === "night" ? rgba(theme.accent, 0.35) : theme.accent}`,
      }}
    >
      <div tw="flex" style={shown(only, "footer-logo")}>
        {/* eslint-disable-next-line @next/next/no-img-element -- Satori yalnızca düz <img> okur. */}
        <img src={brandLogo} alt={BRAND_LOGO_ALT} width={brandLogoWidth(BRAND_LOGO_HEIGHT)} height={BRAND_LOGO_HEIGHT} />
      </div>
      <span style={{ fontFamily: EYEBROW, fontWeight: 700, fontSize: 14, letterSpacing: 3, color: theme.footerText, lineHeight: 1, ...shown(only, "footer-text") }}>{note}</span>
    </div>
  );
}
