import { matchCenter, splitTitle, weeklyKindLabel, weeklyLayout, weeklyPlan } from "@/lib/dashboard/weekly-fixtures-layout";
import type { WeeklyFixturesCardInput } from "@/types/weekly-fixtures";
import { BODY, upper } from "../deep-analysis/deep-analysis-tokens";
import { LeagueCardDivider, LeagueCardFooter, LeagueCardGlow, LeagueCardHeader } from "./league-card-chrome";
import { WeeklyRow } from "./weekly-row";
import { weeklyTheme } from "./weekly-theme";

/**
 * HAFTANIN MAÇLARI — lig/tur fikstürü ve skorları (Satori; boyut seçilen formattan, bkz. types/studio-formats.ts).
 *
 * Üstte lig logosu + lig adı + büyük tur başlığı ("7. HAFTA") + tür ("FİKSTÜR" / "MAÇ SONUÇLARI"),
 * ortada günlere (kupa grup aşamasında gruplara) bölünmüş maç satırları, altta CheckMatch imzası
 * (".net"siz) ve saat dilimi notu. Yerleşim `weeklyLayout`ten gelir: Story'de platform bantları boş kalır,
 * yatay formatta maçlar iki sütuna yayılır. Tipografi: başlık/saat/skor Archivo Black (sıkı harf aralığı), takım
 * adları ve gün/grup ayraçları Bricolage Grotesque ExtraBold, künye Space Mono. Çerçeve Puan Durumu ile ortaktır
 * (`league-card-chrome.tsx`).
 */

export interface WeeklyFixturesCardData extends WeeklyFixturesCardInput {
  /** CheckMatch logosu (".net"siz, data URL). */
  brandLogo: string;
  /** Gömülü (data URL) logolar, maç kimliğine göre; okunamayan logo boş. */
  teamLogos: Record<string, { home: string; away: string }>;
}

export function WeeklyFixturesCard({ leagueId, leagueName, leagueLogoUrl, title, grouping, matches, format, brandLogo, teamLogos }: WeeklyFixturesCardData) {
  const theme = weeklyTheme(leagueId);
  const layout = weeklyLayout(format);
  const { width: W, pad: PAD } = layout;
  // Sığmayan kart motor tarafından reddedilir; yine de çizilirse tek sütun + en küçük satır.
  const plan = weeklyPlan(matches, grouping, layout) ?? { columns: [[{ key: "all", label: "", matches }]], rowHeight: layout.minRow };
  const contentWidth = W - PAD * 2;
  const columnWidth = Math.floor((contentWidth - layout.columnGap * (plan.columns.length - 1)) / plan.columns.length);
  const { kicker, main } = splitTitle(title);

  return (
    <div tw="relative flex h-full w-full flex-col" style={{ fontFamily: BODY, color: theme.text, backgroundImage: theme.background, overflow: "hidden" }}>
      <LeagueCardGlow layout={layout} theme={theme} />
      <LeagueCardHeader
        layout={layout}
        theme={theme}
        leagueLogoUrl={leagueLogoUrl}
        kicker={kicker ? `${upper(leagueName)} · ${kicker}` : upper(leagueName)}
        title={main}
        kindLabel={weeklyKindLabel(matches)}
      />

      {/* Maçlar: tek sütun (dikey formatlar) ya da yan yana sütunlar (yatay) — satır yüksekliği tüm sütunlarda ortak. */}
      <div tw="flex" style={{ position: "absolute", left: PAD, top: layout.bodyTop, width: contentWidth, gap: layout.columnGap }}>
        {plan.columns.map((column, columnIndex) => (
          <div key={columnIndex} tw="flex flex-col" style={{ width: columnWidth, gap: layout.sectionGap }}>
            {column.map((section) => (
              <div key={section.key} tw="flex flex-col" style={{ gap: layout.rowGap }}>
                <LeagueCardDivider label={section.label} height={layout.sectionHeader - layout.rowGap} theme={theme} />
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

      <LeagueCardFooter layout={layout} theme={theme} brandLogo={brandLogo} note="SAATLER TÜRKİYE SAATİYLE (TSİ)" />
    </div>
  );
}
