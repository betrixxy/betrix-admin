import { z } from "zod";
import { MATCH_DAY_TEMPLATES } from "@/lib/dashboard/match-day-templates";
import { MATCH_DAY_FORMAT_IDS, MATCH_DAY_TEMPLATE_IDS, type MatchDayFormatId } from "@/types/match-day";
import type { SocialFormatId } from "@/types/studio-formats";

/**
 * Maç Günü taslağının inceleme görünümü (canlı prova 2026-11-01): kayıtta `statsSnapshot` yok, bu yüzden
 * eskiden "Eski Kayıt" (yalnızca görüntüleme) açılıyordu. Artık diğer kart türleri gibi set görünümüyle açılır:
 * görsel, gönderi metni, onay/ret, Yayın Merkezi ve kapılar (bahis dili + biçim, `languageGate`). Saf — kayıttan
 * yalnızca okunan alanlar; kart değişikliği stüdyoda yapılır (yeniden üretmek yeni taslak açar).
 */

/** Maç Günü / Vitrin / H2H platform formatı → stüdyo format kimliği (önizleme boyutu, yayın türü). */
export const MATCH_DAY_SOCIAL_FORMAT: Record<MatchDayFormatId, SocialFormatId> = { IG_PORTRAIT: "post", IG_SQUARE: "square", STORY: "story", X_LANDSCAPE: "landscape" };

/** `AiContent.renderOptions` — Maç Günü kaydı (`match-day-engine.ts`; inceleme ekranının okuduğu alanlar). */
const matchDayViewSchema = z.object({
  kind: z.literal("MATCH_DAY"),
  template: z.enum(MATCH_DAY_TEMPLATE_IDS),
  format: z.enum(MATCH_DAY_FORMAT_IDS),
  info: z.object({
    homeTeam: z.string(),
    awayTeam: z.string(),
    league: z.string().nullish(),
    week: z.string().nullish(),
    date: z.string().nullish(),
    time: z.string().nullish(),
  }),
});

export interface MatchDayDraftFields {
  title: string;
  subtitle: string;
  kindLabel: string;
  imageUrl: string;
  slides: { url: string; label: string }[];
  format: SocialFormatId;
}

const present = (parts: (string | null | undefined)[]): string[] => parts.map((part) => part?.trim() ?? "").filter((part) => part.length > 0);

/** Formun ISO tarihi "2026-11-01" → "01.11.2026"; başka biçim aynen. */
const shortDate = (date: string | null | undefined): string | undefined => {
  const match = date?.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/u);
  return match ? `${match[3]}.${match[2]}.${match[1]}` : (date ?? undefined);
};

/** Maç Günü kaydının görünüm alanları; kayıt Maç Günü değilse ya da görseli yoksa null. */
export function matchDayDraftFields(renderOptions: unknown, resultImageUrl: string | null): MatchDayDraftFields | null {
  const parsed = matchDayViewSchema.safeParse(renderOptions);
  if (!parsed.success || !resultImageUrl) return null;
  const { template, format, info } = parsed.data;
  const kindLabel = `Maç Günü · ${MATCH_DAY_TEMPLATES[template].label}`;
  return {
    title: `${info.homeTeam} - ${info.awayTeam}`,
    subtitle: present([info.league, info.week, present([shortDate(info.date), info.time]).join(" ")]).join(" · ") || "Maç öncesi",
    kindLabel,
    imageUrl: resultImageUrl,
    slides: [{ url: resultImageUrl, label: kindLabel }],
    format: MATCH_DAY_SOCIAL_FORMAT[format],
  };
}
