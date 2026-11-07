import type { Frozen } from "../reel/freeze";
import { numberWords, percentInWords, percentWords, wordCount } from "../../src/story/speech";
import type { Beat } from "../../src/tactical/types";
import { LEGAL_CAPTION, bannedHits, pct } from "./build";

/**
 * "Canlı taktik tahtası" senaryosu (7 beat, kullanıcı onayı 2026-11-07). Saf: ağa çıkmaz. Her cümle snapshot değerinden KODLA kurulur
 * (rakam yazıyla), ekran değerleri aynı kaynaktan; böylece ses ile ekran ayrışamaz. Skor dağılımı hiç okunmaz
 * (`score_scene_allowed = false` kuralı: skor hiçbir yerde yok). Form dizisi kullanılmaz; "neden" = puan durumu + karne.
 */

export const MAX_WORDS = 90;
/** Kullanıcının verdiği kilitli satır metni (snapshot'ta sayılmıyor; kapanış çağrısı gibi sabit). */
export const MORE_LABEL = "+20 ihtimal daha → www.checkmatch.net";
export const CLOSE_SENTENCE = "Listeyi kaydet, maçtan sonra birlikte bakalım. Tüm analiz checkmatch nokta net'te. Sence skor ne olur? Yorumlara yaz.";

interface Record3 { played: number; win: number; draw: number; lose: number }
interface DuelPlayer { id: number; name: string; goals: number; assists: number; minutes: number; shots_on_target: number }

/** Planın okuduğu alanlar (snapshot'ın dar görünümü; test bunu doğrudan kurar). */
export interface PlanSource {
  simulations: number;
  outcome: { home_win: number; draw: number; away_win: number };
  threePlus: number;
  bothScore: number;
  firstGoal: { home: number; away: number; none: number };
  home: { name: string; rank: number; points: number; venue: Record3; duel: DuelPlayer | null };
  away: { name: string; rank: number; points: number; venue: Record3; duel: DuelPlayer | null };
  duelScope: string;
}

export interface PlanItem {
  kind: Beat["kind"];
  tag: string;
  title: string;
  sentence: string;
  /** ElevenLabs'e giden metin (ses etiketi dahil); yoksa `sentence`. Ekran ve altyazı `sentence`'tan. */
  voiceText?: string;
  values: Beat["values"];
}

/** Ekrandaki sayımla sözcük: ardışık rakam sözcükleri ("yüzde yetmiş beş", "yüz bin") tek sözcük sayılır (%75, 100.000). */
const NUMBER_WORD = /^(yüzde|sıfır|bir|iki|üç|dört|beş|altı|yedi|sekiz|dokuz|on|yirmi|otuz|kırk|elli|altmış|yetmiş|seksen|doksan|yüz|bin)$/iu;
export function screenWordCount(text: string): number {
  let count = 0, inNumber = false;
  for (const raw of text.split(/\s+/u).filter(Boolean)) {
    const word = raw.replace(/[.,:;?!…]+$/u, "").toLocaleLowerCase("tr-TR");
    const isNumber = NUMBER_WORD.test(word);
    if (!isNumber || !inNumber) count += 1;
    inNumber = isNumber && !/[.,:;?!…]$/u.test(raw);
  }
  return count;
}
/** Kanca ≤ 12 sözcük (ekran sayımı; kullanıcı 2026-11-07). */
export const HOOK_MAX_WORDS = 12;
/** Sürpriz eşiği: favori olmayanın ilk golü atma ihtimali en az bu kadarsa kanca "ilk golde sürpriz" der. */
export const SURPRISE_MIN = 30;

export function planSource(frozen: Frozen): PlanSource {
  const detail = frozen.detail;
  const extras = frozen.extras as unknown as {
    teams: Record<"home" | "away", { name: string }>;
    context: { standings: Record<"home" | "away", { rank: number; points: number }>; teams: Record<"home" | "away", { venue: Record3 }> };
    players: { candidates: Record<"home" | "away", DuelPlayer[]>; duel_scope: string };
  };
  const side = (key: "home" | "away") => ({
    name: extras.teams[key].name,
    rank: extras.context.standings[key].rank,
    points: extras.context.standings[key].points,
    venue: extras.context.teams[key].venue,
    duel: extras.players.candidates[key][0] ?? null,
  });
  return {
    simulations: detail.model.simulations ?? 0,
    outcome: detail.outcome,
    // Eksik olasılık NaN olur ve planda engel olarak raporlanır (0 yazılmaz).
    threePlus: detail.goals.three_plus ?? Number.NaN,
    bothScore: detail.both_score ?? Number.NaN,
    firstGoal: { home: detail.first_goal.home ?? Number.NaN, away: detail.first_goal.away ?? Number.NaN, none: detail.first_goal.none ?? Number.NaN },
    home: side("home"),
    away: side("away"),
    duelScope: extras.players.duel_scope,
  };
}

const capital = (text: string) => text.charAt(0).toLocaleUpperCase("tr-TR") + text.slice(1);

/** Okunuşun son ünlüsü; kısaltmada son harfin adı ("SFK" → "ka"). */
const LETTER_NAMES: Record<string, string> = { B: "be", C: "ce", Ç: "çe", D: "de", F: "fe", G: "ge", H: "he", J: "je", K: "ka", L: "le", M: "me", N: "ne", P: "pe", R: "re", S: "se", Ş: "şe", T: "te", V: "ve", Y: "ye", Z: "ze" };
function spokenTail(name: string): string {
  const last = name.trim().split(/\s+/u).at(-1) ?? name;
  return /^[A-ZÇĞİÖŞÜ]{2,}$/u.test(last) ? LETTER_NAMES[last.at(-1) ?? ""] ?? last.toLocaleLowerCase("tr-TR") : last.toLocaleLowerCase("tr-TR");
}

/** Ayrılma hâli eki kesme işaretiyle: "Galatasaray'dan", "Amed SFK'dan", "Beşiktaş'tan". */
export function ablative(name: string): string {
  const tail = spokenTail(name);
  const vowel = [...tail].reverse().find((char) => "aeıioöuü".includes(char)) ?? "a";
  const back = "aıou".includes(vowel);
  const hard = "fstkçşhp".includes(tail.at(-1) ?? "");
  return `${name}'${hard ? "t" : "d"}${back ? "an" : "en"}`;
}

/** İlgi hâli eki: "Galatasaray'ın", "Amed SFK'nın", "Beşiktaş'ın". */
export function genitive(name: string): string {
  const tail = spokenTail(name);
  const vowel = [...tail].reverse().find((char) => "aeıioöuü".includes(char)) ?? "a";
  const harmony = "aı".includes(vowel) ? "ı" : "ei".includes(vowel) ? "i" : "ou".includes(vowel) ? "u" : "ü";
  const endsVowel = "aeıioöuü".includes(tail.at(-1) ?? "");
  return `${name}'${endsVowel ? "n" : ""}${harmony}n`;
}

/** Üleştirme sayısı: 9 → "dokuzar", 2 → "ikişer", 4 → "dörder". Yalnız son sözcük çekilir. */
const DISTRIBUTIVE: Record<string, string> = { bir: "birer", iki: "ikişer", üç: "üçer", dört: "dörder", beş: "beşer", altı: "altışar", yedi: "yedişer", sekiz: "sekizer", dokuz: "dokuzar", on: "onar", yirmi: "yirmişer", otuz: "otuzar", kırk: "kırkar", elli: "ellişer" };
export function distributiveWords(value: number): string {
  const parts = numberWords(value).split(" ");
  const last = parts.pop() ?? "";
  return [...parts, DISTRIBUTIVE[last] ?? last].join(" ");
}

const record = (venue: Record3) => `${venue.win}G ${venue.draw}B ${venue.lose}M`;
const per90 = (player: DuelPlayer) => (((player.goals + player.assists) / Math.max(1, player.minutes)) * 90).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
/** Kart adı: snapshot adayı soyadıyla gelir ("Osimhen"). */
const shortName = (player: DuelPlayer) => player.name;

/** Rakamla başlama kuralı (kalıcı istisna: rakamlı cümlenin sonundaki kısa "çünkü" yan cümlesi; kapanış çağrısı hariç). */
const NUMBER_START = /^(yüzde|sıfır|bir|iki|üç|dört|beş|altı|yedi|sekiz|dokuz|on|yirmi|otuz|kırk|elli|altmış|yetmiş|seksen|doksan|yüz|bin)/iu;
export const sentencesOf = (text: string) => text.split(/(?<=[.?!])\s+/u).filter(Boolean);

export function tacticalPlan(source: PlanSource): { items: PlanItem[]; problems: string[] } {
  const problems: string[] = [];
  const { home, away } = source;
  const outcome = { home: pct(source.outcome.home_win), draw: pct(source.outcome.draw), away: pct(source.outcome.away_win) };
  if (Math.abs(outcome.home + outcome.draw + outcome.away - 100) > 1) problems.push(`kazanma ihtimalleri toplamı ${outcome.home + outcome.draw + outcome.away}`);
  if (!source.simulations) problems.push("simülasyon sayısı yok");
  const missing = Object.entries({ "3+ gol": source.threePlus, "iki takım da gol": source.bothScore, "ilk gol ev": source.firstGoal.home, "ilk gol deplasman": source.firstGoal.away, "ilk gol yok": source.firstGoal.none }).filter(([, value]) => !Number.isFinite(value));
  problems.push(...missing.map(([name]) => `olasılık yok: ${name}`));
  const favourite = outcome.home >= outcome.away ? { side: "home" as const, name: home.name, value: outcome.home } : { side: "away" as const, name: away.name, value: outcome.away };
  const underdog = favourite.side === "home" ? { name: away.name, value: outcome.away } : { name: home.name, value: outcome.home };

  // 2 · "çünkü": favori ev sahibiyse ve iç sahada yenilmediyse (olgu; modelin nedeni iddia edilmez).
  const unbeaten = favourite.side === "home" && home.venue.played > 0 && home.venue.lose === 0;
  if (!unbeaten) problems.push("çünkü cümlesi: favori iç sahada yenilmemiş ev sahibi değil, kalıp yok");

  const three = pct(source.threePlus);
  const both = pct(source.bothScore);
  const first = { home: pct(source.firstGoal.home), away: pct(source.firstGoal.away), none: pct(source.firstGoal.none) };

  const duelHome = home.duel;
  const duelAway = away.duel;
  let duelSentence = "";
  if (!duelHome || !duelAway) problems.push("düello oyuncusu yok");
  else if (duelHome.goals !== duelAway.goals) problems.push("düello cümlesi: gol sayıları farklı, kalıp yok");
  else if (duelHome.shots_on_target === duelAway.shots_on_target) problems.push("düello cümlesi: isabetli şut eşit, kalıp yok");
  else {
    const leader = duelHome.shots_on_target > duelAway.shots_on_target ? duelHome : duelAway;
    duelSentence = `${capital(distributiveWords(duelHome.goals))} gol: ${shortName(duelHome)} ve ${shortName(duelAway)}. ${capital(numberWords(leader.shots_on_target))} isabetli şutla ${shortName(leader)} önde.`;
  }

  const items: PlanItem[] = [
    {
      // Kanca (kullanıcı metni 2026-11-07): favori + açık döngü ("ilk golde sürpriz", "both" beat'inde kapanır) + simülasyon sayısı.
      kind: "hook", tag: "SİMÜLASYON", title: "",
      sentence: `${favourite.name} ${percentWords(favourite.value)} favori… ama ilk golde bir sürpriz var. ${capital(numberWords(source.simulations))} kez oynattık.`,
      voiceText: `[excited] ${favourite.name} ${percentWords(favourite.value)} favori… ama ilk golde bir sürpriz var. ${capital(numberWords(source.simulations))} kez oynattık.`,
      values: { ...outcome, hero: favourite.value, heroSide: favourite.side, hookFavourite: favourite.name, hookLine2: "ama ilk golde sürpriz var", hookAccent: "sürpriz", countLabel: "kez oynattık" },
    },
    {
      kind: "outcome", tag: "SİMÜLASYON", title: "Kazanma ihtimali",
      sentence: `${capital(percentWords(outcome.draw))} beraberlik, ${percentWords(underdog.value)} ${underdog.name}, çünkü ${home.name} iç sahada ${numberWords(home.venue.played)} maçtır kaybetmedi.`,
      values: { ...outcome, because: `İç sahada ${home.venue.played} maç: ${home.venue.win} galibiyet, ${home.venue.draw} beraberlik, ${home.venue.lose} yenilgi` },
    },
    {
      kind: "goals", tag: "GOL", title: "Kaç gol olur?",
      sentence: `${capital(percentWords(three))} ihtimalle üç ve daha fazla gol.`,
      values: { over: three, under: 100 - three, overLabel: "3 ve daha fazla gol", underLabel: "2 veya daha az gol" },
    },
    {
      kind: "both", tag: "GOL", title: "İki takım da gol atar mı?",
      sentence: `${capital(percentWords(both))} ihtimalle iki takım da gol atar. ${capital(percentWords(first.home))} ilk gol ${ablative(home.name)}, ama ${percentWords(first.away)} ${ablative(away.name)}.`,
      values: { both, bothLabel: "İki takımın da gol atma ihtimali", firstLabel: "İlk golü atma ihtimali", firstHome: first.home, firstAway: first.away, firstNone: first.none },
    },
    {
      kind: "why", tag: "PUAN DURUMU", title: "Neden?",
      sentence: `${capital(numberWords(home.rank))} ve ${numberWords(away.rank)}: ${home.name} ${numberWords(home.points)}, ${away.name} ${numberWords(away.points)} puan.`,
      values: { homeRank: home.rank, awayRank: away.rank, homePoints: home.points, awayPoints: away.points, homeRecord: `${home.name} iç saha ${record(home.venue)}`, awayRecord: `${away.name} deplasman ${record(away.venue)}` },
    },
    {
      kind: "duel", tag: "DÜELLO", title: duelHome && duelAway ? `${shortName(duelHome)} – ${shortName(duelAway)}` : "",
      sentence: duelSentence,
      values: duelHome && duelAway ? {
        scope: source.duelScope.replace(/^Trendyol\s+/u, ""),
        homePlayerId: duelHome.id, awayPlayerId: duelAway.id, homeName: shortName(duelHome), awayName: shortName(duelAway),
        goalsHome: duelHome.goals, goalsAway: duelAway.goals, assistsHome: duelHome.assists, assistsAway: duelAway.assists,
        shotsHome: duelHome.shots_on_target, shotsAway: duelAway.shots_on_target, per90Home: per90(duelHome), per90Away: per90(duelAway),
      } : {},
    },
    {
      kind: "close", tag: "", title: "Maç sonu kontrol listesi",
      sentence: CLOSE_SENTENCE,
      values: {
        c1: `Kazanan: ${favourite.name} %${favourite.value}`,
        c2: `3 ve daha fazla gol %${three}`,
        c3: `İki takım da gol %${both}`,
        c4: `İlk gol: ${first.home >= first.away ? home.name : away.name} %${Math.max(first.home, first.away)}`,
        more: MORE_LABEL,
      },
    },
  ];

  const surprise = favourite.side === "home" ? first.away : first.home;
  if (surprise < SURPRISE_MIN) problems.push(`kanca: ilk golde sürpriz yok (%${surprise} < %${SURPRISE_MIN})`);
  const hookWords = screenWordCount(items[0]?.sentence ?? "");
  if (hookWords > HOOK_MAX_WORDS) problems.push(`kanca ${hookWords} sözcük > ${HOOK_MAX_WORDS}`);
  // Toplam sözcük ekran sayımıyla (rakam öbeği tek sözcük); süre sınırı (≤ 42 sn) ölçülen sesle `full.ts`'de.
  const words = items.reduce((sum, item) => sum + screenWordCount(item.sentence), 0);
  if (words > MAX_WORDS) problems.push(`seslendirme ${words} sözcük > ${MAX_WORDS}`);
  // Rakamla başlama kuralı: kanca (kullanıcı metni) ve kapanış çağrısı hariç.
  for (const item of items.slice(1, -1)) {
    for (const sentence of sentencesOf(item.sentence)) if (!NUMBER_START.test(sentence)) problems.push(`${item.kind}: cümle rakamla başlamıyor: "${sentence}"`);
  }
  const texts = items.flatMap((item) => [item.sentence, item.tag, item.title, ...Object.values(item.values).filter((value): value is string => typeof value === "string")]);
  problems.push(...bannedHits(texts).map((hit) => `yasak sözcük: ${hit}`));
  return { items, problems };
}

/** Gönderi açıklaması (aciklama.txt): kanca + site + 5 hashtag + yasal uyarı. Skor yok. */
export function tacticalCaption(source: PlanSource, items: readonly PlanItem[]): string {
  const hook = items[0]?.values;
  const both = items.find((item) => item.kind === "both")?.values;
  const tag = (name: string) => `#${name.replace(/\s+/gu, "")}`;
  return [
    `${(source.simulations / 1000).toLocaleString("tr-TR")} bin simülasyonda ${String(hook?.hookFavourite ?? "")} %${String(hook?.hero ?? "")} — ${genitive(source.away.name)} ilk golü atma ihtimali ise %${String(both?.firstAway ?? "")}.`,
    "Maçın tüm analizi ve 20+ ihtimal: www.checkmatch.net (link profilde)",
    [tag(source.home.name), tag(source.away.name), "#SüperLig", "#MaçAnalizi", "#CheckMatch"].join(" "),
    LEGAL_CAPTION,
  ].join("\n");
}
