import type { FormationId } from "@/types/studio";

export const FORMATIONS: FormationId[] = ["4-3-3", "4-4-2", "4-2-3-1", "3-5-2"];

/** Kaleciden hücuma doğru sıralanmış mevki etiketleri */
export const FORMATION_POSITIONS: Record<FormationId, string[]> = {
  "4-3-3": [
    "Kaleci",
    "Sağ Bek",
    "Stoper",
    "Stoper",
    "Sol Bek",
    "Orta Saha",
    "Orta Saha",
    "Orta Saha",
    "Sağ Kanat",
    "Santrfor",
    "Sol Kanat",
  ],
  "4-4-2": [
    "Kaleci",
    "Sağ Bek",
    "Stoper",
    "Stoper",
    "Sol Bek",
    "Sağ Orta Saha",
    "Merkez Orta Saha",
    "Merkez Orta Saha",
    "Sol Orta Saha",
    "Santrfor",
    "Santrfor",
  ],
  "4-2-3-1": [
    "Kaleci",
    "Sağ Bek",
    "Stoper",
    "Stoper",
    "Sol Bek",
    "Ön Libero",
    "Ön Libero",
    "Ofansif Orta Saha",
    "Sağ Kanat",
    "Sol Kanat",
    "Santrfor",
  ],
  "3-5-2": [
    "Kaleci",
    "Stoper",
    "Stoper",
    "Stoper",
    "Sağ Kanat Bek",
    "Orta Saha",
    "Orta Saha",
    "Orta Saha",
    "Sol Kanat Bek",
    "Santrfor",
    "Santrfor",
  ],
};
