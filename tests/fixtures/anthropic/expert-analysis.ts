import type { ExpertAnalysisOutput } from "@/lib/services/anthropic";

/**
 * Kurgusal Claude yanıtı (bkz. CLAUDE.md 5.2) — şema gerçek çıktıyla birebir. Bilerek iki hata
 * içerir: uydurulmuş bir sayı ("4.2 büyük şans") ve olgu paketinde olmayan bir oyuncu.
 */
export const EXPERT_ANALYSIS_OUTPUT: ExpertAnalysisOutput = {
  home: {
    strengths: ["Maç başı 1.7 xG ile net pozisyon üretimi", "%86 pas isabetiyle oyunu kuruyor", "Maç başı 4.2 büyük şans yaratıyor"],
    cautions: ["Son 3 maçta yalnızca 1 galibiyet", "Geçiş savunmasında kırılgan", ""],
    key_players: [
      { name: "Forvet Bir", role: "Ceza sahası içinde bitirici, 3 gol" },
      { name: "Uydurma Oyuncu", role: "Yaratıcı on numara" },
      { name: "Orta Saha", role: "Oyun kurucu" },
    ],
    approach: "Rakibin topu bırakma eğilimine karşı %56 topla oynamayı koruyup sabırlı pas oyunuyla kanatları açmalı. ".repeat(6),
    quote: "Bu maçın anahtarı orta saha kontrolü olacak.",
  },
  away: {
    strengths: ["Kompakt blok", "", ""],
    cautions: ["Maç başı 1.0 gol yiyor", "", ""],
    key_players: [{ name: "defans", role: "Hava toplarında güçlü stoper" }],
    approach: "Kontra ataklarla sonuç aramalı.",
    quote: "",
  },
  market: { pick: "KG Var", rationale: "İki takımın son 6 maçında 4 kez karşılıklı gol" },
};
