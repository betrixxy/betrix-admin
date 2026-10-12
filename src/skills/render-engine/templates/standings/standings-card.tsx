import { seasonLabel, standingsLayout, standingsPlan, standingsStatColumns } from "@/lib/dashboard/standings-layout";
import { bodyOffsetTop } from "@/lib/dashboard/weekly-fixtures-layout";
import type { StandingsCardInput } from "@/types/standings";
import { BODY, upper } from "../deep-analysis/deep-analysis-tokens";
import { LeagueCardDivider, LeagueCardFooter, LeagueCardGlow, LeagueCardHeader } from "../weekly-fixtures/league-card-chrome";
import { weeklyTheme } from "../weekly-fixtures/weekly-theme";
import { StandingsHeaderRow, StandingsRow, standingsNameSize } from "./standings-row";

/**
 * PUAN DURUMU — ligin (kupada grubun) puan tablosu (Satori; boyut seçilen formattan, bkz. types/studio-formats.ts).
 *
 * Haftanın Maçları'nın çerçevesini, temalarını (yerel ligler açık/kurumsal, Avrupa kupaları gece + neon) ve
 * tipografi hiyerarşisini birebir kullanır. Dar formatlarda (4:5, 9:16, 1:1) yalnızca O · AV · P, yatayda tam
 * tablo (O G B M A Y AV P) çizilir; yatayda takımlar iki sütuna (1-10 / 11-20) yayılır.
 */

export interface StandingsCardData extends StandingsCardInput {
  /** CheckMatch logosu (".net"siz, data URL). */
  brandLogo: string;
  /** Gömülü (data URL) takım logoları, takım kimliğine göre; okunamayan logo boş. */
  teamLogos: Record<number, string>;
}

export function StandingsCard({ leagueId, leagueName, leagueLogoUrl, season, title, kindLabel, sections, format, brandLogo, teamLogos }: StandingsCardData) {
  const theme = weeklyTheme(leagueId);
  const layout = standingsLayout(format);
  const wide = format === "landscape";
  const columns = standingsStatColumns(format);
  // Sığmayan kart motor tarafından reddedilir; yine de çizilirse tek sütun + en küçük satır.
  const plan = standingsPlan(sections, layout) ?? { columns: [sections], rowHeight: layout.minRow, height: 0 };
  const contentWidth = layout.width - layout.pad * 2;
  const columnWidth = Math.floor((contentWidth - layout.columnGap * (plan.columns.length - 1)) / plan.columns.length);
  const nameSize = standingsNameSize(
    sections.flatMap((section) => section.rows.map((row) => row.teamName)),
    columns,
    wide,
    plan.rowHeight,
    columnWidth,
  );
  const legend = columns.map((column) => `${column.label} ${upper(column.name)}`).join(" · ");

  return (
    <div tw="relative flex h-full w-full flex-col" style={{ fontFamily: BODY, color: theme.text, backgroundImage: theme.background, overflow: "hidden" }}>
      <LeagueCardGlow layout={layout} theme={theme} />
      <LeagueCardHeader
        layout={layout}
        theme={theme}
        leagueLogoUrl={leagueLogoUrl}
        kicker={`${upper(leagueName)} · ${seasonLabel(season)}`}
        title={upper(title)}
        kindLabel={kindLabel}
      />

      {/* Tablo: tek sütun (dikey formatlar) ya da yan yana iki sütun (yatay) — her sütunun üstünde başlık satırı. */}
      <div tw="flex" style={{ position: "absolute", left: layout.pad, top: bodyOffsetTop(layout, plan.height), width: contentWidth, gap: layout.columnGap }}>
        {plan.columns.map((column, columnIndex) => (
          <div key={columnIndex} tw="flex flex-col" style={{ width: columnWidth }}>
            <StandingsHeaderRow columns={columns} wide={wide} height={layout.tableHeader - layout.rowGap} theme={theme} />
            <div tw="flex flex-col" style={{ marginTop: layout.rowGap, gap: layout.sectionGap }}>
              {column.map((section) => (
                <div key={section.key} tw="flex flex-col" style={{ gap: layout.rowGap }}>
                  {section.label ? <LeagueCardDivider label={section.label} height={layout.sectionHeader - layout.rowGap} theme={theme} /> : null}
                  {section.rows.map((row) => (
                    <StandingsRow
                      key={row.teamId}
                      row={row}
                      logo={teamLogos[row.teamId] ?? ""}
                      columns={columns}
                      wide={wide}
                      height={plan.rowHeight}
                      width={columnWidth}
                      nameSize={nameSize}
                      theme={theme}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <LeagueCardFooter layout={layout} theme={theme} brandLogo={brandLogo} note={legend} />
    </div>
  );
}
