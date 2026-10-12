import { WEEKLY_LAYOUT, matchCenter, splitTitle, weeklyKindLabel, weeklyRowHeight, weeklySections } from "@/lib/dashboard/weekly-fixtures-layout";
import type { WeeklyFixturesCardInput } from "@/types/weekly-fixtures";
import { BRAND_LOGO_ALT, brandLogoWidth } from "../brand";
import { BODY, EYEBROW, SCORE, TEAM, rgba, upper } from "../deep-analysis/deep-analysis-tokens";
import { WeeklyRow } from "./weekly-row";
import { weeklyTheme } from "./weekly-theme";

/**
 * HAFTANIN MAÇLARI — lig/tur fikstürü ve skorları (Satori, 1080×1350 / IG 4:5).
 *
 * Üstte lig logosu + lig adı + büyük tur başlığı ("7. HAFTA") + tür ("FİKSTÜR" / "MAÇ SONUÇLARI"),
 * ortada günlere (kupa grup aşamasında gruplara) bölünmüş maç satırları, altta CheckMatch imzası
 * (".net"siz) ve saat dilimi notu. Tipografi: başlık/saat/skor Archivo Black (sıkı harf aralığı), takım
 * adları ve gün/grup ayraçları Bricolage Grotesque ExtraBold, künye Space Mono.
 */

export const WEEKLY_FIXTURES_CARD_SIZE = { width: 1080, height: 1350 } as const;

const W = WEEKLY_FIXTURES_CARD_SIZE.width;
const H = WEEKLY_FIXTURES_CARD_SIZE.height;
const PAD = 56;
const FOOTER_HEIGHT = 128;
const BRAND_LOGO_HEIGHT = 46;
const LEAGUE_LOGO = 116;

export interface WeeklyFixturesCardData extends WeeklyFixturesCardInput {
  /** CheckMatch logosu (".net"siz, data URL). */
  brandLogo: string;
  /** Gömülü (data URL) logolar, maç kimliğine göre; okunamayan logo boş. */
  teamLogos: Record<string, { home: string; away: string }>;
}

/** Büyük başlık tek satıra sığacak boyutta (Archivo Black büyük harf ≈ 0.78 em/karakter). */
function titleSize(title: string, available: number): number {
  return Math.max(48, Math.min(104, Math.floor(available / (Math.max(1, title.length) * 0.78))));
}

export function WeeklyFixturesCard({ leagueId, leagueName, leagueLogoUrl, title, grouping, matches, brandLogo, teamLogos }: WeeklyFixturesCardData) {
  const theme = weeklyTheme(leagueId);
  const sections = weeklySections(matches, grouping);
  const rowHeight = weeklyRowHeight(sections.length, matches.length) ?? WEEKLY_LAYOUT.minRow;
  const contentWidth = W - PAD * 2;
  const { kicker, main } = splitTitle(title);
  const textWidth = contentWidth - (leagueLogoUrl ? LEAGUE_LOGO + (theme.leagueBadge ? 28 : 0) + 32 : 0);
  const size = titleSize(main, textWidth);

  return (
    <div tw="relative flex h-full w-full flex-col" style={{ fontFamily: BODY, color: theme.text, backgroundImage: theme.background, overflow: "hidden" }}>
      {theme.glow ? (
        <div style={{ position: "absolute", left: 80, top: -520, width: 1000, height: 1000, backgroundImage: `radial-gradient(${rgba(theme.glow, 0.28)} 0%, ${rgba(theme.glow, 0)} 70.7%)` }} />
      ) : null}

      {/* Başlık */}
      <div tw="flex items-center" style={{ position: "absolute", left: PAD, top: 64, width: contentWidth, gap: 32 }}>
        {leagueLogoUrl ? (
          <div
            tw="flex items-center justify-center"
            style={{
              width: LEAGUE_LOGO + (theme.leagueBadge ? 28 : 0),
              height: LEAGUE_LOGO + (theme.leagueBadge ? 28 : 0),
              borderRadius: 28,
              backgroundColor: theme.leagueBadge ?? "rgba(0,0,0,0)",
              boxShadow: theme.leagueBadge ? `0 0 40px ${rgba(theme.accent, 0.35)}` : "none",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- Satori yalnızca düz <img> okur. */}
            <img src={leagueLogoUrl} alt="" width={LEAGUE_LOGO} height={LEAGUE_LOGO} style={{ objectFit: "contain" }} />
          </div>
        ) : null}
        <div tw="flex flex-col" style={{ gap: 14, flex: 1 }}>
          <span style={{ fontFamily: EYEBROW, fontWeight: 700, fontSize: 19, letterSpacing: 4, color: theme.muted, lineHeight: 1 }}>
            {kicker ? `${upper(leagueName)} · ${kicker}` : upper(leagueName)}
          </span>
          <span style={{ fontFamily: SCORE, fontSize: size, lineHeight: 1, letterSpacing: Math.min(-2, -size * 0.035), color: theme.text, whiteSpace: "nowrap" }}>{main}</span>
          <div tw="flex items-center" style={{ gap: 12 }}>
            <div style={{ width: 34, height: 4, backgroundColor: theme.accent }} />
            <span style={{ fontFamily: EYEBROW, fontWeight: 700, fontSize: 17, letterSpacing: 4, color: theme.accent, lineHeight: 1 }}>{weeklyKindLabel(matches)}</span>
          </div>
        </div>
      </div>

      {/* Maçlar */}
      <div tw="flex flex-col" style={{ position: "absolute", left: PAD, top: WEEKLY_LAYOUT.bodyTop, width: contentWidth, gap: WEEKLY_LAYOUT.sectionGap }}>
        {sections.map((section) => (
          <div key={section.key} tw="flex flex-col" style={{ gap: WEEKLY_LAYOUT.rowGap }}>
            <div tw="flex items-center" style={{ height: WEEKLY_LAYOUT.sectionHeader - WEEKLY_LAYOUT.rowGap, gap: 14 }}>
              <span style={{ fontFamily: TEAM, fontWeight: 800, fontSize: 15, letterSpacing: 5, color: theme.accent, lineHeight: 1 }}>{section.label}</span>
              <div style={{ flex: 1, height: 1, backgroundColor: theme.rowBorder }} />
            </div>
            {section.matches.map((match) => (
              <WeeklyRow
                key={match.id}
                match={match}
                center={matchCenter(match, grouping)}
                logos={teamLogos[match.id] ?? { home: "", away: "" }}
                rowHeight={rowHeight}
                width={contentWidth}
                theme={theme}
              />
            ))}
          </div>
        ))}
      </div>

      {/* İmza bandı */}
      <div
        tw="flex items-center justify-between"
        style={{
          position: "absolute",
          left: 0,
          top: H - FOOTER_HEIGHT,
          width: W,
          height: FOOTER_HEIGHT,
          padding: `0 ${PAD}px`,
          backgroundColor: theme.footerBg,
          borderTop: `2px solid ${theme.mode === "night" ? rgba(theme.accent, 0.35) : theme.accent}`,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- Satori yalnızca düz <img> okur. */}
        <img src={brandLogo} alt={BRAND_LOGO_ALT} width={brandLogoWidth(BRAND_LOGO_HEIGHT)} height={BRAND_LOGO_HEIGHT} />
        <span style={{ fontFamily: EYEBROW, fontWeight: 700, fontSize: 14, letterSpacing: 3, color: theme.footerText, lineHeight: 1 }}>SAATLER TÜRKİYE SAATİYLE (TSİ)</span>
      </div>
    </div>
  );
}
