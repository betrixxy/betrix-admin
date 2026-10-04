import { MATCH_DAY_TEMPLATE_IDS, type MatchDayTemplateId } from "@/types/match-day";

/** Şablonların görünen bilgileri ve üretim özellikleri — istemci bileşenleri de kullanır. */
export interface MatchDayTemplateMeta {
  label: string;
  description: string;
  /** false → arka plan programatik çizilir (Fal.ai flux çağrısı yok, ücretsiz). */
  aiBackground: boolean;
  /** false → AI harmanlama (image-to-image) bu şablonda hiç yapılmaz (düz zeminde gereksiz). */
  harmonize: boolean;
}

export const MATCH_DAY_TEMPLATES: Record<MatchDayTemplateId, MatchDayTemplateMeta> = {
  PREMIUM_BROADCAST: {
    label: "Premium Broadcast",
    description: "Yayın kuruluşu maç önü grafiği: gerçekçi stadyum, büyük oyuncular, kalın 'MAÇ GÜNÜ', ince ayraçlı künye.",
    aiBackground: true,
    harmonize: true,
  },
  DATA_DRIVEN: {
    label: "Data Driven",
    description: "Veri ajansı infografiği: koyu düz zemin, büyük tarih bloğu, son 5 maç formu ve gerçek istatistik kutuları.",
    aiBackground: false,
    harmonize: false,
  },
  EDITORIAL_PORTRAIT: {
    label: "Editorial Portrait",
    description: "Dergi kapağı: dramatik stüdyo ışığı, oyuncu portreleri, serif takım adları, sade künye.",
    aiBackground: true,
    harmonize: true,
  },
};

/** Formdaki "Rastgele" seçeneğinin değeri — sunucu bunu gerçek bir şablona çevirir. */
export const RANDOM_TEMPLATE = "RANDOM";

export function isMatchDayTemplateId(value: string): value is MatchDayTemplateId {
  return MATCH_DAY_TEMPLATE_IDS.some((id) => id === value);
}

export function pickRandomTemplate(): MatchDayTemplateId {
  const index = Math.floor(Math.random() * MATCH_DAY_TEMPLATE_IDS.length);
  return MATCH_DAY_TEMPLATE_IDS[index] ?? "PREMIUM_BROADCAST";
}
