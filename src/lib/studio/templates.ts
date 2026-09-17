import type { TemplateDef, TemplateId } from "@/types/studio";

export const TEMPLATES: TemplateDef[] = [
  {
    id: "match-day",
    label: "Maç Günü Kartı",
    description:
      "Skor tahmini, xG ve yıldız oyuncu görselleriyle klasik maç önü kartı.",
  },
  {
    id: "ai-prediction",
    label: "Yapay Zeka Tahmini",
    description:
      "İddaa oranları ve AI güven skoruna dayalı tahmin odaklı içerik.",
  },
  {
    id: "team-analysis",
    label: "Derinlemesine Takım Analizi",
    description:
      "İki takımın form, şut ve xG verilerini karşılaştıran istatistik kartı.",
  },
  {
    id: "lineup",
    label: "Muhtemel 11",
    description: "Formasyon ve kadro dizilişini gösteren taktik kart.",
  },
];

export function getTemplate(id: TemplateId): TemplateDef {
  const template = TEMPLATES.find((t) => t.id === id);
  if (!template) throw new Error(`Bilinmeyen şablon: ${id}`);
  return template;
}
