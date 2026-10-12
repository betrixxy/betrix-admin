import { matchCenter, splitTitle, weeklyKindLabel, weeklyLayout, weeklyPlan } from "@/lib/dashboard/weekly-fixtures-layout";
import type { WeeklyFixturesCardInput } from "@/types/weekly-fixtures";
import { BRAND_LOGO_ALT, brandLogoWidth } from "../brand";
import { BODY, EYEBROW, SCORE, TEAM, rgba, upper } from "../deep-analysis/deep-analysis-tokens";
import { WeeklyRow } from "./weekly-row";
import { weeklyTheme } from "./weekly-theme";

/**
 * HAFTANIN MAÇLARI — lig/tur fikstürü ve skorları (Satori; boyut seçilen formattan, bkz. types/studio-formats.ts).
 *
 * Üstte lig logosu + lig adı + büyük tur başlığı ("7. HAFTA") + tür ("FİKSTÜR" / "MAÇ SONUÇLARI"),
 * ortada günlere (kupa grup aşamasında gruplara) bölünmüş maç satırları, altta CheckMatch imzası
 * (".net"siz) ve saat dilimi notu. Yerleşim `weeklyLayout`ten gelir: Story'de platform bantları boş kalır,
 * yatay formatta maçlar iki sütuna yayılır. Tipografi: başlık/saat/skor Archivo Black (sıkı harf aralığı), takım
 * adları ve gün/grup ayraçları Bricolage Grotesque ExtraBold, künye Space Mono.
 */

const BRAND_LOGO_HEIGHT = 46;
const LEAGUE_LOGO = 116;

export interface WeeklyFixturesCardData extends WeeklyFixturesCardInput {
  /** CheckMatch logosu (".net"siz, data URL). */
  brandLogo: string;
  /** Gömülü (data URL) logolar, maç kimliğine göre; okunamayan logo boş. */
  teamLogos: Record<string, { home: string; away: string }>;
}

/** Büyük başlık tek satıra sığacak boyutta (Archivo Black büyük harf ≈ 0.78 em/karakter). */
function titleSize(title: string, available: number, max: number): number {
  return Math.max(48, Math.min(max, Math.floor(available / (Math.max(1, title.length) * 0.78))));
}

export function WeeklyFixturesCard({ leagueId, leagueName, leagueLogoUrl, title, grouping, matches, format, brandLogo, teamLogos }: WeeklyFixturesCardData) {
  const theme = weeklyTheme(leagueId);
  const layout = weeklyLayout(format);
  const { width: W, height: H, pad: PAD } = layout;
  // Sığmayan kart motor tarafından reddedilir; yine de çizilirse tek sütun + en küçük satır.
  const plan = weeklyPlan(matches, grouping, layout) ?? { columns: [[{ key: "all", label: "", matches }]], rowHeight: layout.minRow };
  const contentWidth = W - PAD * 2;
  const columnWidth = Math.floor((contentWidth - layout.columnGap * (plan.columns.length - 1)) / plan.columns.length);
  const { kicker, main } = splitTitle(title);
  const textWidth = contentWidth - (leagueLogoUrl ? LEAGUE_LOGO + (theme.leagueBadge ? 28 : 0) + 32 : 0);
  const size = titleSize(main, textWidth, layout.titleMax);

  return (
    <div tw="relative flex h-full w-full flex-col" style={{ fontFamily: BODY, color: theme.text, backgroundImage: theme.background, overflow: "hidden" }}>
      {theme.glow ? (
        <div style={{ position: "absolute", left: Math.round(W / 2 - 460), top: -520, width: 1000, height: 1000, backgroundImage: `radial-gradient(${rgba(theme.glow, 0.28)} 0%, ${rgba(theme.glow, 0)} 70.7%)` }} />
      ) : null}

      {/* Başlık */}
      <div tw="flex items-center" style={{ position: "absolute", left: PAD, top: layout.headerTop, width: contentWidth, gap: 32 }}>
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

      {/* Maçlar: tek sütun (dikey formatlar) ya da yan yana sütunlar (yatay) — satır yüksekliği tüm sütunlarda ortak. */}
      <div tw="flex" style={{ position: "absolute", left: PAD, top: layout.bodyTop, width: contentWidth, gap: layout.columnGap }}>
        {plan.columns.map((column, columnIndex) => (
          <div key={columnIndex} tw="flex flex-col" style={{ width: columnWidth, gap: layout.sectionGap }}>
            {column.map((section) => (
              <div key={section.key} tw="flex flex-col" style={{ gap: layout.rowGap }}>
                <div tw="flex items-center" style={{ height: layout.sectionHeader - layout.rowGap, gap: 14 }}>
                  <span style={{ fontFamily: TEAM, fontWeight: 800, fontSize: 15, letterSpacing: 5, color: theme.accent, lineHeight: 1 }}>{section.label}</span>
                  <div style={{ flex: 1, height: 1, backgroundColor: theme.rowBorder }} />
                </div>
                {section.matches.map((match) => (
                  <WeeklyRow
                    key={match.id}
                    match={match}
                    center={matchCenter(match, grouping)}
                    logos={teamLogos[match.id] ?? { home: "", away: "" }}
                    rowHeight={plan.rowHeight}
                    width={columnWidth}
                    theme={theme}
                  />
                ))}
              </div>
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
          top: layout.footerTop,
          width: W,
          // Bant kanvasın altına kadar iner; içerik üstteki `footerHeight` şeridinde ortalanır (Story alt bandı boş kalır).
          height: H - layout.footerTop,
          padding: `0 ${PAD}px ${H - layout.footerTop - layout.footerHeight}px`,
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
