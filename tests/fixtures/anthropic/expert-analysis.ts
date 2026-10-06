import type { ExpertAnalysisOutput } from "@/lib/services/anthropic";

/**
 * Kurgusal Claude yanıtı (bkz. CLAUDE.md 5.2) — şema gerçek çıktıyla birebir. "Çelik Kasa"
 * denetimini sınamak için bilerek şu hataları içerir:
 * - Ev sahibi güçlü yön 2: deplasmanın topla oynama oranı (%41) — takım karışmış.
 * - Ev sahibi güçlü yön 3: hiçbir pakette olmayan sayı (4.2) — uydurma.
 * - Ev sahibi alıntı: lakap ("Gala").
 * - Olgu paketinde olmayan bir oyuncu.
 * Doğru kullanımlar (uyarı üretmemeli): ev sahibi yaklaşımında rakibin sayısı (%41), market
 * gerekçesinde market çizgisi (2.5) ve iki takımın sayıları.
 */
export const EXPERT_ANALYSIS_OUTPUT: ExpertAnalysisOutput = {
  home: {
    strengths: ["Maç başı 1.7 xG ile net pozisyon üretimi", "%41 topla oynamaya rağmen etkili", "Maç başı 4.2 büyük şans yaratıyor"],
    cautions: ["Son 3 maçta yalnızca 1 galibiyet", "Geçiş savunmasında kırılgan", ""],
    key_players: [
      { name: "Forvet Bir", role: "Ceza sahası içinde bitirici, 3 gol" },
      { name: "Uydurma Oyuncu", role: "Yaratıcı on numara" },
      { name: "Orta Saha", role: "Oyun kurucu" },
    ],
    approach: "Kasımpaşa'nın %41 topla oynamasına karşı sabırlı pas oyunuyla kanatları açmalı. ".repeat(6),
    quote: "Gala'nın orta saha kontrolü bu maçın anahtarı olacak.",
  },
  away: {
    strengths: ["Kompakt blok", "", ""],
    cautions: ["Maç başı 2.4 gol yiyor", "", ""],
    key_players: [{ name: "deplasman golcü", role: "Hava toplarında güçlü santrfor" }],
    approach: "Galatasaray'ın %56 topla oynamasına karşı kontra ataklarla sonuç aramalı.",
    quote: "",
  },
  market: { pick: "2.5 Üst", rationale: "Ev sahibi maç başı 1.7 xG, deplasman 2.4 gol yiyor; 2.5 çizgisi aşılabilir" },
};
