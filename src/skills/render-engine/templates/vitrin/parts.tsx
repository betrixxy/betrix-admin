import { BODY, DISPLAY, fitFontSize } from "../match-day/shared";

/**
 * Vitrin carousel'inin ortak yapı taşları (Satori). Panel/kutu çerçevesi yok: hiyerarşi tipografi ve
 * boşlukla kurulur; tek istisna analiz sayfasındaki kilitli "bilet".
 */

export const SHADE_RGB = "7,8,12";
export const TEXT_SHADOW = "0 2px 14px rgba(0,0,0,0.6)";
export const MUTED = "rgba(255,255,255,0.62)";

/** Anton'da rakam ≈ 0,5 em; Geist "%" ≈ 0,42 × 0,9 em + boşluk. `Percent` genişlik tahmini (yerleşim). */
export function percentWidth(value: number, size: number): number {
  return Math.round(size * (0.42 * 0.9 + 0.04) + String(value).length * size * 0.5);
}

/** "%64" → küçük "%" (Geist; Anton'un yüzde glifi "0/o" gibi okunuyor) + büyük rakam (Anton). */
export function Percent({ value, size, color }: { value: number; size: number; color: string }) {
  return (
    <div tw="flex items-start" style={{ color }}>
      <span style={{ fontFamily: BODY, fontWeight: 800, fontSize: Math.round(size * 0.42), lineHeight: 1, marginTop: Math.round(size * 0.08), marginRight: Math.round(size * 0.04) }}>%</span>
      <span style={{ fontFamily: DISPLAY, fontSize: size, lineHeight: 1 }}>{String(value)}</span>
    </div>
  );
}

/** "%64" → 64 (kart alanları yüzdeyi metin taşır). */
export const percentValue = (text: string): number => Number(text.replace("%", "")) || 0;

/** Küçük, aralıklı büyük harf bölüm etiketi — vurgu renginde. */
export function SectionLabel({ text, color, size, maxWidth }: { text: string; color: string; size: number; maxWidth: number }) {
  const upper = text.toLocaleUpperCase("tr-TR");
  const fitted = fitFontSize(upper, maxWidth, size, 0.7, Math.round(size * 0.7));
  return <span style={{ fontFamily: BODY, fontWeight: 800, fontSize: fitted, lineHeight: 1, letterSpacing: fitted * 0.16, color }}>{upper}</span>;
}

export function LockIcon({ size, color }: { size: number; color: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="4" y="10.5" width="16" height="11" rx="2.5" fill={color} />
      <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" stroke={color} strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}
