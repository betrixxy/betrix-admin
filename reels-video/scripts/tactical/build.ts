import type { Frozen } from "../reel/freeze";
import type { Alignment } from "../reel/tts";
import type { Beat, Camera, SpokenWord, TacticalPlayer, TacticalScript, TacticalTeam } from "../../src/tactical/types";

/**
 * Snapshot → TacticalScript parçaları. Rakam üretilmez: her değer snapshot alanından, yuvarlama burada ve tek yerde.
 * Kadro: API-Football son resmî maç ilk 11'i (snapshot `context.teams.<taraf>.lineup`), oyuncular `grid` sırasıyla dondurulmuş;
 * hat/sütun bu sıradan ve dizilişten geri kurulur (kaleci + dizilişin hatları). Güncel kadroda olmayan oyuncu tahtaya girmez.
 */

export const LEGAL_SCREEN = "Bilgilendirme amaçlıdır. Olasılıklar gerçek maç verilerine ve istatistiksel simülasyona dayanır; kesin sonuç garantisi vermez ve yatırım tavsiyesi niteliği taşımaz.";
export const LEGAL_CAPTION = "Yasal uyarı: Bu içerik, gerçek maç verileri ve istatistiksel simülasyon modelleri kullanılarak yalnızca bilgilendirme amacıyla hazırlanmıştır. Yer alan olasılıklar kesin sonuç garantisi vermez; yatırım, yönlendirme veya tavsiye niteliği taşımaz. İçeriğe dayanılarak verilen kararlardan CheckMatch sorumlu tutulamaz.";

/** Ekran, ses, altyazı ve açıklamada yasak (tam sözcük; "üst üste" serbest). */
export const BANNED = [/\bbahis\w*/iu, /\boran\b|\boranı\b|\boranlar\w*/iu, /\bkupon\w*/iu, /\biddaa\b/iu, /\bbanko\b/iu, /(^|[^\p{L}])üst($|[^\p{L}])(?!üste)/iu, /(^|[^\p{L}])alt($|[^\p{L}])/iu, /\bKG\b/u, /handikap/iu, /tahmin tutar/iu, /kazandırır/iu];

export function bannedHits(texts: readonly string[]): string[] {
  return texts.flatMap((value) => BANNED.filter((pattern) => pattern.test(value.replace(/üst üste/giu, ""))).map((pattern) => `${pattern.source} → "${value}"`));
}

export const pct = (value: number) => Math.round(value * 100);

type Detail = Frozen["detail"];
type Extras = Frozen["extras"];

function team(frozen: Frozen, side: "home" | "away", problems: string[]): TacticalTeam {
  const extras = frozen.extras as Extras & Record<string, unknown>;
  const info = extras.teams[side];
  const context = (extras as unknown as { context: { teams: Record<"home" | "away", { lineup: { formation: string; players: { id: number; name: string; number: number | null }[] } | null }>; absences: Record<"home" | "away", { id: number }[]> } }).context;
  const lineup = context.teams[side].lineup;
  const squad = new Set((extras as unknown as { players: { squads: Record<"home" | "away", { id: number }[]> } }).players.squads[side].map((player) => player.id));
  const out = new Set(context.absences[side].map((player) => player.id));
  const players: TacticalPlayer[] = [];
  if (!lineup) problems.push(`${side}: muhtemel 11 yok`);
  else {
    const lines = [1, ...lineup.formation.split("-").map(Number)];
    if (lines.reduce((sum, count) => sum + count, 0) !== 11 || lineup.players.length !== 11) problems.push(`${side}: diziliş ${lineup.formation} 11 oyuncuya uymuyor`);
    let at = 0;
    lines.forEach((columns, lineIndex) => {
      for (let column = 1; column <= columns; column += 1) {
        const player = lineup.players[at++];
        if (!player) continue;
        if (!squad.has(player.id)) { problems.push(`${side}: ${player.name} güncel kadroda yok, tahtaya girmedi`); continue; }
        players.push({ id: player.id, name: player.name, number: player.number, line: lineIndex + 1, column, lines: lines.length, columns, out: out.has(player.id) });
      }
    });
  }
  return { name: info.name, short: info.short_name, logo: info.logo, primary: info.colors.primary, secondary: info.colors.secondary, formation: lineup?.formation ?? "", players };
}

export function kickoffLabel(utc: string): string {
  const date = new Date(utc);
  const day = new Intl.DateTimeFormat("tr-TR", { weekday: "short", timeZone: "Europe/Istanbul" }).format(date).replace(".", "");
  const time = new Intl.DateTimeFormat("tr-TR", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Europe/Istanbul" }).format(date);
  return `${day} ${time}`;
}

/** "7 KASIM CUMARTESİ · 19:00" (İstanbul). */
export function dateLabel(utc: string): string {
  const date = new Date(utc);
  const day = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long", weekday: "long", timeZone: "Europe/Istanbul" }).formatToParts(date);
  const part = (type: string) => day.find((item) => item.type === type)?.value ?? "";
  const time = new Intl.DateTimeFormat("tr-TR", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Europe/Istanbul" }).format(date);
  return `${part("day")} ${part("month")} ${part("weekday")} · ${time}`.toLocaleUpperCase("tr-TR");
}

export function baseScript(frozen: Frozen, backdrop: string | null): { script: Omit<TacticalScript, "beats" | "words" | "durationInFrames">; problems: string[] } {
  const detail = frozen.detail as Detail;
  const extras = frozen.extras as Extras;
  const problems: string[] = [];
  const home = team(frozen, "home", problems);
  const away = team(frozen, "away", problems);
  const round = (extras as unknown as { round: string }).round;
  if (!detail.model.simulations) problems.push("simülasyon sayısı yok");
  return {
    script: {
      simulations: detail.model.simulations ?? 0,
      kickoffLabel: kickoffLabel(detail.match.kickoff_utc),
      competitionLabel: `${detail.match.league.name} · ${round}`,
      site: "www.checkmatch.net",
      legal: LEGAL_SCREEN,
      dateLabel: dateLabel(detail.match.kickoff_utc),
      venue: (extras as unknown as { venue: string | null }).venue ?? null,
      backdrop,
      home,
      away,
    },
    problems,
  };
}

export const CAMERAS: Record<Beat["kind"], Camera> = {
  hook: { tilt: 22, zoom: 1.02, panX: 0, panY: 40, rotate: 0 },
  outcome: { tilt: 48, zoom: 1.0, panX: 0, panY: 170, rotate: 0 },
  goals: { tilt: 52, zoom: 1.25, panX: 0, panY: 520, rotate: 0 },
  both: { tilt: 38, zoom: 0.92, panX: 0, panY: 120, rotate: 0 },
  first: { tilt: 50, zoom: 1.2, panX: 0, panY: 460, rotate: -6 },
  why: { tilt: 30, zoom: 1.0, panX: 0, panY: 80, rotate: 0 },
  duel: { tilt: 44, zoom: 1.55, panX: 0, panY: 120, rotate: 0 },
  upset: { tilt: 46, zoom: 1.15, panX: 0, panY: -260, rotate: 4 },
  close: { tilt: 60, zoom: 0.85, panX: 0, panY: 260, rotate: 0 },
};

/** Zaman damgasından sözcükler (ses etiketleri atlanır), saniye cinsinden. */
export function wordsOf(alignment: Alignment, from: number, to: number): { text: string; start: number; end: number }[] {
  const words: { text: string; start: number; end: number }[] = [];
  let current: { text: string; start: number; end: number } | null = null;
  let inTag = false;
  alignment.characters.forEach((char, index) => {
    const start = alignment.character_start_times_seconds[index] ?? 0;
    const end = alignment.character_end_times_seconds[index] ?? start;
    if (char === "[") inTag = true;
    const skip = inTag || start < from || end > to + 0.02;
    if (char === "]") { inTag = false; return; }
    if (skip || /\s/u.test(char)) { if (current) words.push(current); current = null; return; }
    if (!current) current = { text: char, start, end };
    else { current.text += char; current.end = end; }
  });
  if (current) words.push(current);
  return words;
}

export function toFrames(words: { text: string; start: number; end: number }[], offsetSeconds: number, clipStart: number, beat: number, fps: number): SpokenWord[] {
  return words.map((word) => ({ text: word.text, start: Math.round((word.start - clipStart + offsetSeconds) * fps), end: Math.round((word.end - clipStart + offsetSeconds) * fps), beat }));
}
