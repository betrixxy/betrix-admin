import { upperName } from "@/lib/dashboard/name-case";
import type { ReactNode } from "react";
import type { TeamAnalysisDraft } from "@/types/deep-analysis";
import { BRAND_LOGO_ALT, brandLogoWidth } from "../brand";
import { BangGlyph, CheckGlyph, Eyebrow, GearGlyph, KeyPlayer, PointColumn, StatRow } from "./deep-analysis-parts";
import { BODY, GRAY, GREEN, GREEN_BR, MAX_WIDTH, SCORE, TEAM, YELLOW, filled } from "./deep-analysis-tokens";

/**
 * Kartın bölüm blokları — her yerleşim (4:5/9:16 tek sütun, 1:1 ve 16:9 grid) aynı blokları kendi
 * düzeninde dizer. Boş bölüm `null` döner (çizilmez). `s` = ölçek (4:5 = 1).
 */
export interface DeepAnalysisBlocks {
  /** Logo + üst etiket + takım adı. */
  header: (onHero: boolean) => ReactNode;
  /** Güçlü yönler + dikkat edilmesi gerekenler; `stacked` = alt alta (dar sütun). */
  points: (stacked: boolean) => ReactNode;
  /** Anahtar oyuncular; `stacked` = alt alta (dar sütun). */
  players: (stacked: boolean) => ReactNode;
  stats: ReactNode;
  approach: ReactNode;
  quote: ReactNode;
  brand: ReactNode;
}

export interface DeepAnalysisText {
  team: TeamAnalysisDraft;
  opponentName: string;
  brandLogo: string;
  eyebrow: string;
  quoteAttribution: string;
}

export function deepAnalysisBlocks({ team, opponentName, brandLogo, eyebrow, quoteAttribution }: DeepAnalysisText, s: number): DeepAnalysisBlocks {
  const strengths = filled(team.strengths).slice(0, 3);
  const cautions = filled(team.cautions).slice(0, 3);
  const players = team.keyPlayers.filter((player) => player.name.trim()).slice(0, 3);
  const approach = team.approach.trim();
  const quote = team.quote.trim();
  const block = { width: "100%", maxWidth: MAX_WIDTH } as const;

  return {
    header: (onHero) => (
      <div tw="flex items-center" style={{ gap: Math.round(20 * s), justifyContent: onHero ? "flex-start" : "center" }}>
        {team.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- Satori yalnızca düz <img> okur.
          <img src={team.logoUrl} alt="" width={Math.round(76 * s)} height={Math.round(76 * s)} style={{ objectFit: "contain" }} />
        ) : null}
        <div tw="flex flex-col">
          <Eyebrow color={GRAY} size={16 * s} spacing={3} opacity={0.8}>
            {eyebrow}
          </Eyebrow>
          <span style={{ fontFamily: TEAM, fontWeight: 800, fontSize: Math.round((onHero ? 52 : 44) * s), letterSpacing: 0.3, lineHeight: 1.05, marginTop: 2 }}>
            {upperName(team.teamName)}
          </span>
        </div>
      </div>
    ),

    points: (stacked) =>
      strengths.length + cautions.length > 0 ? (
        <div tw={stacked ? "flex flex-col" : "flex"} style={{ ...block, gap: Math.round((stacked ? 14 : 26) * s) }}>
          {strengths.length > 0 ? <PointColumn title="Güçlü Yönler" color={GREEN_BR} points={strengths} glyph={<CheckGlyph />} s={s} stacked={stacked} /> : null}
          {cautions.length > 0 ? <PointColumn title="Dikkat Edilmesi Gerekenler" color={YELLOW} points={cautions} glyph={<BangGlyph />} s={s} stacked={stacked} /> : null}
        </div>
      ) : null,

    players: (stacked) =>
      players.length > 0 ? (
        <div tw="flex flex-col" style={block}>
          <div tw="flex justify-center" style={{ marginBottom: Math.round(12 * s) }}>
            <Eyebrow color={GRAY} size={14 * s} spacing={1.5} opacity={0.8}>
              Anahtar Oyuncular
            </Eyebrow>
          </div>
          <div tw={stacked ? "flex flex-col" : "flex"} style={{ gap: Math.round((stacked ? 10 : 18) * s) }}>
            {players.map((player, index) => (
              <KeyPlayer key={index} {...player} s={s} stacked={stacked} />
            ))}
          </div>
        </div>
      ) : null,

    stats: <StatRow stats={team.stats} s={s} />,

    approach: approach ? (
      <div
        tw="flex flex-col"
        style={{
          ...block,
          padding: `${Math.round(18 * s)}px ${Math.round(24 * s)}px`,
          borderRadius: 14,
          border: "1.5px solid rgba(245,197,24,0.5)",
          backgroundImage: "linear-gradient(160deg, rgba(245,197,24,0.1), rgba(245,197,24,0.02))",
        }}
      >
        <div tw="flex items-center" style={{ marginBottom: Math.round(8 * s) }}>
          <GearGlyph />
          <Eyebrow color={YELLOW} size={14 * s}>{`${opponentName} Karşısında Önerilen Yaklaşım`}</Eyebrow>
        </div>
        <span data-wrap style={{ fontFamily: BODY, fontWeight: 500, fontSize: 17.5 * s, lineHeight: 1.4 }}>{approach}</span>
      </div>
    ) : null,

    quote: quote ? (
      <div tw="flex flex-col" style={{ ...block, borderLeft: `4px solid ${GREEN}`, borderRadius: 4, padding: `2px 0 2px ${Math.round(24 * s)}px` }}>
        <span style={{ fontFamily: SCORE, fontSize: 40 * s, color: GREEN_BR, lineHeight: 0.8, height: Math.round(22 * s), marginBottom: 4 }}>&quot;</span>
        <span data-wrap style={{ fontFamily: BODY, fontWeight: 500, fontSize: 19 * s, lineHeight: 1.38, color: GRAY, transform: "skewX(-9deg)" }}>{quote}</span>
        <div tw="flex" style={{ marginTop: Math.round(8 * s) }}>
          <Eyebrow color={GREEN_BR} size={13 * s} spacing={1.5}>
            {quoteAttribution}
          </Eyebrow>
        </div>
      </div>
    ) : null,

    // Marka imzası: logo + altın çizgi (.cm-brandmark).
    brand: (
      <div tw="flex flex-col items-center" style={{ gap: Math.round(9 * s) }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- Satori yalnızca düz <img> okur. */}
        <img src={brandLogo} alt={BRAND_LOGO_ALT} width={brandLogoWidth(Math.round(40 * s))} height={Math.round(40 * s)} />
        <div style={{ width: Math.round(420 * s), height: 2, backgroundImage: `linear-gradient(90deg, rgba(245,197,24,0), ${YELLOW} 15%, ${YELLOW} 85%, rgba(245,197,24,0))` }} />
      </div>
    ),
  };
}
