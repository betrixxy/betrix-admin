import { fullDate, shortDate as dayMonth } from "@/lib/format/dates";
import { nameOrigin, originFromCountry, teamNameOrigin, upperCompetition, upperName } from "@/lib/dashboard/name-case";
import { upperTr } from "@/lib/dashboard/match-result-labels";
import { cardTeamColor } from "@/lib/dashboard/vitrin-card";
import { drawTeamName } from "@/lib/draw/entry";
import { headToHeadFact } from "@/lib/draw/facts";
import { bannedWordsGate } from "@/lib/prediction/banned-words";
import type { DrawCard, DrawCardBody, DrawState, DrawTeamCard, DrawTurkishRow, DrawVariant, HeadToHeadRecord } from "@/types/draw";
import type { Result } from "@/types/result";

/**
 * Kura sonucu kartının alanları — saf, TEK KAYNAK (motor, offline script, görsel test). Yalnızca olgu:
 * rakip, sıra (ilk maç nerede), tarih, torba (biliniyorsa), geçmiş karşılaşma (veri varsa). Turnuva
 * logosu yok — adı tipografik. Eksik eşleşmeyle de üretilir (yalnızca girilenler).
 */

const GOLD = "#F5C518";
const NEUTRAL = "#E8E8EA";
const SHORT_COMPETITION: Readonly<Record<number, string>> = { 2: "ŞAMPİYONLAR LİGİ", 3: "AVRUPA LİGİ", 848: "KONFERANS LİGİ" };


export interface DrawCardInput {
  variant: DrawVariant;
  /** B çok turnuvalı olabilir; A ve C tek kura. */
  states: DrawState[];
  /** A: odak takım. */
  focusTeamId?: number | null;
  /** Takım kimliği → logo (data URI); yoksa baş harf. */
  logos: Readonly<Record<number, string | null>>;
  /** A · eleme: odak takımın rakiple geçmişi (veri yoksa null → satır yok). */
  headToHead?: HeadToHeadRecord | null;
  brandLogo: string;
}

type Fail = { ok: false; error: { code: string; message: string } };
const fail = (code: string, message: string): Fail => ({ ok: false, error: { code, message } });

export function teamCard(state: DrawState, id: number, logos: DrawCardInput["logos"]): DrawTeamCard {
  const team = state.teams.find((entry) => entry.id === id);
  const name = drawTeamName(state, id);
  // Türkçe karşılıkla yazılan yabancı kulüp ("Bayern Münih", "Dinamo Kiev") Türkçe büyük harfle; diğerleri ülkeden.
  const origin = teamNameOrigin(name, { name: originFromCountry(team?.country) ?? nameOrigin(name), people: null });
  return { id, name: upperName(name, origin), logo: logos[id] ?? null, turkish: team?.country === "Turkey" };
}

function footerLine(state: DrawState): string {
  return [upperCompetition(state.competition.name), upperTr(state.roundLabel), state.drawDateUtc ? `KURA ${fullDate(state.drawDateUtc)}` : null].filter(Boolean).join(" · ");
}

const venueLabel = (venue: "HOME" | "AWAY") => (venue === "HOME" ? "İÇ SAHA" : "DEPLASMAN");
const orderLabel = (homeFirst: boolean) => (homeFirst ? "İLK MAÇ İÇ SAHADA" : "İLK MAÇ DEPLASMANDA");

function teamBody(state: DrawState, input: DrawCardInput): Result<DrawCardBody> {
  const focus = input.focusTeamId;
  if (!focus) return fail("NO_FOCUS", "Takım odaklı kart için takımı seçin.");
  const team = teamCard(state, focus, input.logos);
  if (state.stage === "KNOCKOUT") {
    const tie = state.ties.find((t) => t.first === focus || t.second === focus);
    if (!tie) return fail("NO_ENTRY", `${drawTeamName(state, focus)} için eşleşme girilmedi.`);
    const opponentId = tie.first === focus ? tie.second : tie.first;
    const opponent = teamCard(state, opponentId, input.logos);
    const dates = [tie.firstLegUtc ? `1. MAÇ ${dayMonth(tie.firstLegUtc)}` : null, tie.secondLegUtc ? `2. MAÇ ${dayMonth(tie.secondLegUtc)}` : null].filter(Boolean).join(" · ");
    const fact = headToHeadFact(drawTeamName(state, focus), drawTeamName(state, opponentId), input.headToHead ?? null);
    return { ok: true, data: { kind: "TEAM_KNOCKOUT", team, opponent, order: orderLabel(tie.first === focus), dates, fact } };
  }
  const fixtures = state.fixtures.filter((f) => f.teamId === focus);
  if (fixtures.length === 0) return fail("NO_ENTRY", `${drawTeamName(state, focus)} için rakip girilmedi.`);
  const home = fixtures.filter((f) => f.venue === "HOME").length;
  const cells = fixtures.map((f) => {
    const pot = state.teams.find((t) => t.id === f.opponentId)?.pot ?? null;
    return { opponent: teamCard(state, f.opponentId, input.logos), venue: f.venue, venueLabel: venueLabel(f.venue), potLabel: pot ? `${pot}. TORBA` : "", dateLabel: f.dateUtc ? dayMonth(f.dateUtc) : "" };
  });
  return { ok: true, data: { kind: "TEAM_LEAGUE", team, summary: `${fixtures.length} RAKİP · ${home} İÇ SAHA · ${fixtures.length - home} DEPLASMAN`, cells } };
}

function turkishBody(input: DrawCardInput): Result<DrawCardBody> {
  const multi = input.states.length > 1;
  const rows: DrawTurkishRow[] = input.states.flatMap((state) => {
    const tag = multi ? (SHORT_COMPETITION[state.competition.id] ?? upperCompetition(state.competition.name)) : "";
    return state.teams
      .filter((team) => team.country === "Turkey")
      .flatMap((team): DrawTurkishRow[] => {
        if (state.stage === "KNOCKOUT") {
          const tie = state.ties.find((t) => t.first === team.id || t.second === team.id);
          if (!tie) return [];
          const opponentId = tie.first === team.id ? tie.second : tie.first;
          return [{ team: teamCard(state, team.id, input.logos), tag, opponents: [{ team: teamCard(state, opponentId, input.logos), venue: tie.first === team.id ? "HOME" : "AWAY" }], order: orderLabel(tie.first === team.id) }];
        }
        const fixtures = state.fixtures.filter((f) => f.teamId === team.id);
        if (fixtures.length === 0) return [];
        return [{ team: teamCard(state, team.id, input.logos), tag, opponents: fixtures.map((f) => ({ team: teamCard(state, f.opponentId, input.logos), venue: f.venue })), order: "" }];
      });
  });
  if (rows.length === 0) return fail("NO_ENTRY", "Türk takımları için eşleşme girilmedi.");
  if (rows.length > 5) return fail("TOO_MANY", `Temsilcilerimiz kartı en fazla 5 takım alır (${rows.length} girildi).`);
  const first = input.states[0]!;
  const subtitle = multi ? `${first.season}/${String((first.season + 1) % 100).padStart(2, "0")} AVRUPA KUPALARI` : `${upperCompetition(first.competition.name)} · ${upperTr(first.roundLabel)}`;
  return { ok: true, data: { kind: "TURKISH", title: "TEMSİLCİLERİMİZ", subtitle, rows } };
}

function allBody(state: DrawState, input: DrawCardInput): Result<DrawCardBody> {
  if (state.stage !== "KNOCKOUT") return fail("NOT_KNOCKOUT", "Tüm eşleşmeler kartı yalnızca eleme turunda.");
  if (state.ties.length === 0) return fail("NO_ENTRY", "Eşleşme girilmedi.");
  const ties = state.ties.map((tie) => {
    const [first, second] = [teamCard(state, tie.first, input.logos), teamCard(state, tie.second, input.logos)];
    return { first, second, highlight: first.turkish || second.turkish };
  });
  return { ok: true, data: { kind: "ALL", title: `${upperTr(state.roundLabel)} EŞLEŞMELERİ`, ties } };
}

const PAGE_LABELS: Record<DrawCardBody["kind"], string[]> = {
  TEAM_KNOCKOUT: ["01 · KURA"],
  TEAM_LEAGUE: ["01 · KURA", "02 · RAKİPLER"],
  TURKISH: ["01 · TEMSİLCİLERİMİZ"],
  ALL: ["01 · EŞLEŞMELER"],
};

export function buildDrawCard(input: DrawCardInput): Result<DrawCard> {
  const state = input.states[0];
  if (!state) return fail("NO_DRAW", "Kura bilgisi yok.");
  const body = input.variant === "TEAM" ? teamBody(state, input) : input.variant === "TURKISH" ? turkishBody(input) : allBody(state, input);
  if (!body.ok) return body;
  const accentHex = body.data.kind === "TEAM_KNOCKOUT" || body.data.kind === "TEAM_LEAGUE" ? (cardTeamColor(body.data.team.id, []) ?? NEUTRAL) : GOLD;
  const multi = input.states.length > 1;
  const card: DrawCard = {
    body: body.data,
    pageLabels: PAGE_LABELS[body.data.kind],
    dateLabel: !multi && state.drawDateUtc ? fullDate(state.drawDateUtc) : `${state.season}/${String((state.season + 1) % 100).padStart(2, "0")}`,
    accentHex,
    footerLine: multi ? `${state.season}/${String((state.season + 1) % 100).padStart(2, "0")} · ŞAMPİYONLAR LİGİ · AVRUPA LİGİ · KONFERANS LİGİ` : footerLine(state),
    brandLogo: input.brandLogo,
  };
  const language = drawTextGate(card);
  if (language) return fail("BANNED_LANGUAGE", `${language} — kart üretilmedi.`);
  return { ok: true, data: card };
}

/** Kartın bütün metinleri dil kapısından (yasaklı liste). */
export function drawTextGate(card: DrawCard): string | null {
  return bannedWordsGate({ "kart metni": JSON.stringify(card.body).replace(/data:[^"]+/g, ""), künye: card.footerLine, "sayfa etiketi": card.pageLabels.join(" ") });
}
