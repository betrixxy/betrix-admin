/**
 * Analist notu iki alandır: ekran özeti kartta görünür, seslendirme notu okunur ve video açıklamasına gider.
 * Saf modül: panel de video paketi de aynı kuralı kullanır (`reels-video/src/story/`).
 */

export const SCREEN_NOTE_MAX_WORDS = 15;
/** Kartta en çok 2 satır: 40 px yazıda ölçülen sınır. Asıl denetim karede (`lib/dom-audit.ts`). */
export const SCREEN_NOTE_MAX_CHARS = 84;
export const VOICE_NOTE_MAX_CHARS = 280;
export const VOICE_NOTE_MAX_SENTENCES = 3;
/** 8 sn'lik kartta okunabilecek sözcük: varsayım 3 sözcük/sn, gerçek sesle ölçülmedi. */
export const NOTE_CARD_MAX_WORDS = 24;

export const noteWordCount = (text: string): number => text.trim().split(/\s+/u).filter(Boolean).length;
const sentencesOf = (text: string): string[] => text.trim().split(/(?<=[.!?…])\s+/u).filter((part) => part.trim().length > 0);

/**
 * Seslendirme notunu iki karta böler: "Maçın anahtarı" sığan cümleleri okur, kalanı "checkmatch senaryosu".
 * Cümle bölünmez. Sığmıyorsa null.
 */
export function splitVoiceNote(note: string): [string, string | null] | null {
  const first: string[] = [];
  const second: string[] = [];
  for (const sentence of sentencesOf(note)) {
    const target = !second.length && noteWordCount([...first, sentence].join(" ")) <= NOTE_CARD_MAX_WORDS ? first : second;
    target.push(sentence);
  }
  if (!first.length || noteWordCount(second.join(" ")) > NOTE_CARD_MAX_WORDS) return null;
  return [first.join(" "), second.length ? second.join(" ") : null];
}

export function screenNoteProblem(note: string): string | null {
  const words = noteWordCount(note);
  if (words > SCREEN_NOTE_MAX_WORDS) return `Ekran özeti en fazla ${SCREEN_NOTE_MAX_WORDS} sözcük olabilir (${words}).`;
  return note.trim().length > SCREEN_NOTE_MAX_CHARS ? `Ekran özeti iki satıra sığmıyor: en fazla ${SCREEN_NOTE_MAX_CHARS} karakter.` : null;
}

export function voiceNoteProblem(note: string): string | null {
  if (!note.trim()) return null;
  if (note.length > VOICE_NOTE_MAX_CHARS) return `Seslendirme notu en fazla ${VOICE_NOTE_MAX_CHARS} karakter olabilir.`;
  if (sentencesOf(note).length > VOICE_NOTE_MAX_SENTENCES) return `Seslendirme notu en fazla ${VOICE_NOTE_MAX_SENTENCES} cümle olabilir.`;
  return splitVoiceNote(note) ? null : `Seslendirme notu iki karta sığmıyor: cümle başına en fazla ${NOTE_CARD_MAX_WORDS} sözcük, toplam yaklaşık ${NOTE_CARD_MAX_WORDS * 2} sözcük.`;
}
