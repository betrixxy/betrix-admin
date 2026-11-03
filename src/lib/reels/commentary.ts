import { findBannedWords } from "@/lib/prediction/banned-words";

/**
 * Yorum şablonlarının LLM ile doğallaştırılması (denetim, saf). Şablon yuvaları (`{home}`, `{p}`) değişmez ve rakam eklenemez:
 * rakamları kod yerleştirir. Geçemeyen metin atılır, kod şablonu kalır. Video tarafında da aynı denetim var (`story/claims.ts`).
 */

export interface ReelClaimInput { id: string; template: string }

const SLOT = /\{(\w+)\}/gu;
const slotsOf = (text: string): string[] => [...text.matchAll(SLOT)].map((match) => match[1] ?? "").sort();
const MAX_LENGTH_RATIO = 1.3;
/** Veride olmayan iddiaya kapı açan sözcükler: LLM'in şablona taktik ya da transfer eklemesi engellenir. */
const INVENTED_CLAIM = /\b(pres|kontra|kanat|transfer|teknik direktör|hoca|moral|yorgun|motivasyon|taktik|sakatlandı)\w*/iu;

export function auditPolishedClaim(polished: string, template: string): string | null {
  const stripped = polished.replace(SLOT, "");
  if (/\d/u.test(stripped)) return "rakam eklenmiş";
  if (JSON.stringify(slotsOf(polished)) !== JSON.stringify(slotsOf(template))) return "yuvalar değişmiş";
  if (polished.length > template.length * MAX_LENGTH_RATIO) return "uzun";
  if (findBannedWords(stripped).length) return "bahis dili";
  if (INVENTED_CLAIM.test(stripped)) return "veride olmayan iddia";
  // Şablonda olmayan özel ad: cümle başı dışındaki büyük harfli yeni sözcük.
  const known = new Set(template.replace(SLOT, "").split(/\s+/u));
  const invented = stripped.split(/(?<=[.:;!?])\s+/u).flatMap((sentence) => sentence.trim().split(/\s+/u).slice(1)).filter((word) => /^\p{Lu}/u.test(word) && !known.has(word));
  return invented.length ? `yeni özel ad: ${invented.join(" ")}` : null;
}

/** Denetimden geçenler `ReelContext.polished` olur. Geçemeyen sayısı panelde görünür. */
export function acceptPolishedClaims(claims: readonly ReelClaimInput[], output: readonly { id: string; text: string }[]): { polished: Record<string, string>; rejected: { id: string; reason: string }[] } {
  const polished: Record<string, string> = {};
  const rejected: { id: string; reason: string }[] = [];
  const byId = new Map(claims.map((claim) => [claim.id, claim.template]));
  for (const item of output) {
    const template = byId.get(item.id);
    if (!template) { rejected.push({ id: item.id, reason: "bilinmeyen kimlik" }); continue; }
    const problem = auditPolishedClaim(item.text, template);
    if (problem) rejected.push({ id: item.id, reason: problem });
    else polished[item.id] = item.text;
  }
  return { polished, rejected };
}

/** Analist notu: kullanıcının kendi metni. En fazla 3 cümle, 280 karakter. Dil kapısı ayrıca `contentLanguageGate`. */
export const ANALYST_NOTE_MAX = 280;
export function analystNoteProblem(note: string): string | null {
  if (note.length > ANALYST_NOTE_MAX) return `Not en fazla ${ANALYST_NOTE_MAX} karakter olabilir.`;
  const sentences = note.split(/[.!?…]+\s*/u).filter((part) => part.trim().length > 0);
  return sentences.length > 3 ? "Not en fazla 3 cümle olabilir." : null;
}
