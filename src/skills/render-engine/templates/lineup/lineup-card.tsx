import type { LineupCardInput } from "@/types/lineup";
import { BODY, EYEBROW, GRAY, GREEN, GREEN_BR, NAVY_700, NAVY_800, SCORE, TEAM, rgba, upper } from "../deep-analysis/deep-analysis-tokens";
import { LineupPitch } from "./lineup-pitch";

/**
 * MUHTEMEL 11 — tek takımlık kadro kartı (Satori, 1080×1350 / IG 4:5).
 *
 * Tasarım dili CheckMatch marka kimliği: koyu lacivert zemin, neon yeşil vurgular, Derinlemesine
 * Analiz kartıyla aynı font rolleri (Space Mono etiket · Bricolage takım adı · Manrope gövde ·
 * Archivo Black rakam). Oyuncu fotoğrafı kullanılmaz — kart tamamen tipografi + forma numarası
 * odaklıdır; yalnızca takım logosu ve CheckMatch logosu görsel olarak gömülür.
 */

export const LINEUP_CARD_SIZE = { width: 1080, height: 1350 } as const;

const PAD = 60;
const PITCH_WIDTH = LINEUP_CARD_SIZE.width - PAD * 2;
const PITCH_HEIGHT = 850;

export interface LineupCardData extends LineupCardInput {
  /** CheckMatch.net logosu (data URL). */
  brandLogo: string;
}

export function LineupCard({ team, opponentName, headline, matchLabel, brandLogo }: LineupCardData) {
  const colorHex = /^#[0-9a-f]{6}$/i.test(team.colorHex) ? team.colorHex : GREEN;
  const subline = [opponentName ? `vs ${upper(opponentName)}` : "", matchLabel].filter(Boolean).join("  ·  ");

  return (
    <div tw="relative flex h-full w-full flex-col" style={{ fontFamily: BODY, color: "white", backgroundColor: NAVY_800, overflow: "hidden" }}>
      {/* Üstte takım rengi + neon parıltı (arka plan katmanı). */}
      {/* Satori elips boyutu okumaz: merkezlenmiş kutunun varsayılan gradyanında %70.7 durağı = kutu kenarı. */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: -460,
          width: 1080,
          height: 920,
          backgroundImage: `radial-gradient(${rgba(colorHex, 0.36)} 0%, ${rgba(colorHex, 0)} 70.7%)`,
        }}
      />
      <div
        style={{ position: "absolute", left: 0, bottom: 0, width: 1080, height: 420, backgroundImage: `linear-gradient(180deg, ${rgba(NAVY_700, 0)} 0%, ${NAVY_700} 100%)` }}
      />

      {/* Başlık */}
      <div tw="flex items-center justify-between" style={{ padding: `${PAD - 6}px ${PAD}px 0`, gap: 24 }}>
        <div tw="flex flex-col" style={{ gap: 6, maxWidth: 780 }}>
          <div tw="flex items-center" style={{ gap: 12 }}>
            <div style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: GREEN_BR, boxShadow: `0 0 14px ${GREEN_BR}` }} />
            <span style={{ fontFamily: EYEBROW, fontWeight: 700, fontSize: 22, letterSpacing: 6, color: GREEN_BR }}>{upper(headline)}</span>
          </div>
          <span style={{ fontFamily: TEAM, fontWeight: 800, fontSize: team.teamName.length > 16 ? 54 : 66, lineHeight: 1.02, letterSpacing: 0.3 }}>
            {upper(team.teamName)}
          </span>
          {subline ? <span style={{ fontWeight: 600, fontSize: 22, color: GRAY, letterSpacing: 0.5 }}>{subline}</span> : null}
        </div>
        {team.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- Satori yalnızca düz <img> okur.
          <img src={team.logoUrl} alt="" width={128} height={128} style={{ objectFit: "contain" }} />
        ) : null}
      </div>

      {/* Diziliş + teknik direktör şeridi */}
      <div tw="flex items-center justify-between" style={{ padding: `22px ${PAD}px 18px` }}>
        <div tw="flex items-center" style={{ gap: 14 }}>
          <span style={{ fontFamily: EYEBROW, fontWeight: 700, fontSize: 16, letterSpacing: 4, color: GRAY }}>DİZİLİŞ</span>
          <div tw="flex" style={{ padding: "4px 16px", borderRadius: 10, backgroundColor: rgba(GREEN_BR, 0.12), border: `1px solid ${rgba(GREEN_BR, 0.5)}` }}>
            <span style={{ fontFamily: SCORE, fontSize: 30, color: GREEN_BR, letterSpacing: 1 }}>{team.formation}</span>
          </div>
        </div>
        {team.coach.trim() ? (
          <div tw="flex items-center" style={{ gap: 10 }}>
            <span style={{ fontFamily: EYEBROW, fontWeight: 700, fontSize: 16, letterSpacing: 4, color: GRAY }}>T. DİREKTÖR</span>
            <span style={{ fontWeight: 800, fontSize: 22 }}>{upper(team.coach)}</span>
          </div>
        ) : null}
      </div>

      <div tw="flex" style={{ padding: `0 ${PAD}px` }}>
        <LineupPitch formation={team.formation} slots={team.slots} colorHex={colorHex} width={PITCH_WIDTH} height={PITCH_HEIGHT} />
      </div>

      {/* Marka imzası */}
      <div tw="flex flex-1 flex-col items-center justify-center" style={{ gap: 10 }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- Satori yalnızca düz <img> okur. */}
        <img src={brandLogo} alt="CheckMatch.net" width={226} height={44} />
        <div style={{ width: 380, height: 2, backgroundImage: `linear-gradient(90deg, ${rgba(GREEN_BR, 0)}, ${GREEN_BR} 15%, ${GREEN_BR} 85%, ${rgba(GREEN_BR, 0)})` }} />
      </div>
    </div>
  );
}
