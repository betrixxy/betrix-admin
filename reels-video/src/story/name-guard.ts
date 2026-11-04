import type { ReelScene } from "../schema";
import type { MatchData } from "./match-data";

/**
 * Ad bekçisi: senaryo metni veride olmayan hiçbir oyuncu adı, transfer ya da eski takım iddiası içeremez. Metindeki büyük
 * harfle başlayan her sözcük ya snapshot + kadro verisinde ya da şablon sözlüğünde olmalı. Sözlük bilinçli olarak küçük ve
 * elle tutulur: yeni şablon metni eklenince test burada durur, gözden geçirilmeden geçmez.
 */

export const TEMPLATE_WORDS = new Set([
  "Maç", "Maçı", "Günü", "Bu", "Kim", "Rahat", "Gollü", "İki", "İlk", "Goller", "Geriden", "Baskı", "Sert", "Penaltı", "En", "Golü",
  "Yıldızların", "Nasıl", "Rakibine", "Kilit", "Takvim", "Kafa", "Modelin", "İhtimal", "Bir", "Senin", "Yorumlara", "Tüm", "Beraberlik", "Son", "Gol", "Asist", "Şut",
  "İsabetli", "Dakika", "Sezon", "Toplam", "Galibiyet", "Tek", "Attığı", "Yediği", "Korner", "Kart", "Kırmızı", "Daha", "Eşit", "Yarı", "Gün", "Avrupa",
  "Monte", "Carlo", "Puan", "Skor", "Mağlubiyet", "Yedek", "Rakibe", "Hiç", "Gole", "Oynadığı", "Beklenen", "Sarı", "Kalan", "Golsüz", "İkinci", "Maçta",
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
  "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar",
  "Dikkat", "Güçlü", "Zayıf", "Hücum", "Savunma", "Aradaki", "Puanlar", "Kazanan", "Form", "Kimler", "Sürpriz", "Sence", "Cevabını", "Kaydet", "Dengeli", "Birinci",
  "Yolu", "Denge", "Dizilişi", "Sence", "İkisinin", "Hiçbiri", "Önce", "Çünkü", "Sürpriz", "Geriden",
  "Az", "Aynı", "Maçların", "Pay", "Takımın", "Kalesini", "Maçın", "Deplasman", "İç", "Önü", "Dengeli", "Attığı", "Yediği",
]);

/** Metin taşımayan alanlar: yol, kimlik, kod. */
/** `analystNote`: kullanıcının kendi yazdığı metin; dil kapısından geçer, ad bekçisine girmez. */
const SKIPPED_KEYS = new Set(["type", "key", "logo", "clubLogo", "photoId", "photoIds", "assets", "side", "better", "leader", "focus", "kind", "date", "form", "last5", "id", "template", "sources", "figures", "status", "analystNote"]);

export function sceneTexts(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(sceneTexts);
  if (value && typeof value === "object") return Object.entries(value).flatMap(([key, item]) => (SKIPPED_KEYS.has(key) ? [] : sceneTexts(item)));
  return [];
}

const WORD = /[\p{L}]+(?:['’][\p{L}]+)?/gu;
const stem = (token: string): string => token.split(/['’]/u)[0] ?? token;
const tokens = (text: string): string[] => (text.match(WORD) ?? []).map(stem);
const isCapital = (token: string): boolean => token[0] !== undefined && token[0] !== token[0].toLocaleLowerCase("tr-TR");

/** Snapshot + kadro verisindeki özel adlar. */
export function knownNames(data: MatchData): Set<string> {
  const { players } = data;
  const values = [
    data.teams.home.name, data.teams.home.short_name, data.teams.away.name, data.teams.away.short_name,
    data.match.league.name, data.match.league.round, data.match.venue, data.match.referee,
    ...data.h2h.matches.flatMap((match) => [match.home, match.away]),
    ...players.squads.home.map((player) => player.name), ...players.squads.away.map((player) => player.name),
    ...players.vs_opponent.flatMap((history) => history.matches.flatMap((match) => [match.club_name, match.opponent_name])),
    ...data.scorer_chances.map((item) => item.name),
    ...(data.context?.absences ? [...data.context.absences.home, ...data.context.absences.away].map((item) => item.name) : []),
  ];
  return new Set(values.flatMap((value) => (value ? tokens(value) : [])));
}

/** Veride ve sözlükte olmayan özel adlar. Boş dizi = temiz. */
export function unknownNames(scenes: readonly (Pick<ReelScene, "headline" | "caption" | "data"> & { voiceover?: ReelScene["voiceover"] })[], data: MatchData): string[] {
  const known = knownNames(data);
  const found = scenes.flatMap((scene) => sceneTexts([scene.headline, scene.caption, scene.data, scene.voiceover?.lines.filter((line) => !line.sources.includes("analyst_note")).map((line) => line.text) ?? []])).flatMap(tokens).filter((token) => isCapital(token) && !known.has(token) && !TEMPLATE_WORDS.has(token));
  return [...new Set(found)];
}
