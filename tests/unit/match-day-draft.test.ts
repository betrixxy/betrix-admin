import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { matchDayDraftFields } from "@/lib/dashboard/match-day-draft";
import { MATCH_DAY_TEMPLATE_IDS } from "@/types/match-day";

/**
 * Maç Günü taslağı inceleme görünümü (canlı prova 2026-11-01): kayıtta `statsSnapshot` olmadığı için "Eski Kayıt"a
 * düşüyor, onay / Yayın Merkezi açılmıyordu. `renderOptions` Kasımpaşa–Beşiktaş kayıtlarının birebir şekli.
 */

const KASIMPASA_BESIKTAS = {
  kind: "MATCH_DAY",
  template: "PREMIUM_BROADCAST",
  format: "IG_PORTRAIT",
  quality: "PREMIUM",
  info: { date: "2026-11-01", time: "19:00", week: "10. Hafta", league: "Trendyol Süper Lig", referee: "R. Coskunses", homeTeam: "Kasımpaşa", awayTeam: "Beşiktaş", homeLogo: "x", awayLogo: "y" },
  studioNotes: ["Kasımpaşa: fotoğraf yok — yedek tasarım"],
};
const IMAGE = "/api/files/renders/0f.png";

describe("Maç Günü taslağı — set görünümü (onay + Yayın Merkezi)", () => {
  it("canlı kayıt: başlık, künye, şablon etiketi, tek görsel, 4:5", () => {
    assert.deepEqual(matchDayDraftFields(KASIMPASA_BESIKTAS, IMAGE), {
      title: "Kasımpaşa - Beşiktaş",
      subtitle: "Trendyol Süper Lig · 10. Hafta · 01.11.2026 19:00",
      kindLabel: "Maç Günü · Premium Broadcast",
      imageUrl: IMAGE,
      slides: [{ url: IMAGE, label: "Maç Günü · Premium Broadcast" }],
      format: "post",
    });
  });

  it("her şablon ve format açılır; künyesiz kayıt da", () => {
    for (const template of MATCH_DAY_TEMPLATE_IDS) {
      for (const [format, social] of [["IG_PORTRAIT", "post"], ["IG_SQUARE", "square"], ["STORY", "story"], ["X_LANDSCAPE", "landscape"]] as const) {
        const fields = matchDayDraftFields({ ...KASIMPASA_BESIKTAS, template, format }, IMAGE);
        assert.equal(fields?.format, social, `${template} ${format}`);
      }
    }
    assert.equal(matchDayDraftFields({ ...KASIMPASA_BESIKTAS, info: { homeTeam: "A", awayTeam: "B", league: null } }, IMAGE)?.subtitle, "Maç öncesi");
  });

  it("görselsiz (takvim yer tutucusu) ya da başka tür kayıt → null (eski yol)", () => {
    assert.equal(matchDayDraftFields(KASIMPASA_BESIKTAS, null), null);
    assert.equal(matchDayDraftFields({ ...KASIMPASA_BESIKTAS, kind: "VITRIN" }, IMAGE), null);
    assert.equal(matchDayDraftFields(null, IMAGE), null);
  });
});
