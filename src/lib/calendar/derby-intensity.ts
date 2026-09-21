import { Flame, Swords, Zap } from "lucide-react";
import type { DerbyIntensity } from "@/types/calendar";

interface DerbyIntensityMeta {
  label: string;
  icon: typeof Flame | null;
  /** Sadece metin/ikon rengi — ağır rozet/parlama kaldırıldı (bkz. sade tasarım kuralı). */
  textClassName: string;
}

export const DERBY_INTENSITY_META: Record<DerbyIntensity, DerbyIntensityMeta> = {
  NONE: { label: "", icon: null, textClassName: "" },
  RIVALRY: { label: "Rekabet", icon: Swords, textClassName: "text-sky-400" },
  DERBY: { label: "Derbi", icon: Zap, textClassName: "text-orange-400" },
  ELITE_DERBY: { label: "Büyük Maç", icon: Flame, textClassName: "text-rose-400" },
};
