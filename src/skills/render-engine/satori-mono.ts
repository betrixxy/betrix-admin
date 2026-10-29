import { Children, cloneElement, isValidElement, type CSSProperties, type ReactElement, type ReactNode } from "react";

/**
 * Space Mono küçük punto okunurluğu — `renderSatori` ortak geçişi (bütün kartlar).
 *
 * Sorun: Space Mono Bold'un N harfinde çapraz çok kalın, iç boşluk yalnızca ince yarıklar; kart
 * etiketlerinin puntosunda (11–19 px) yarıklar kapanıyor ve N dolu bir blok gibi çiziliyor, yanındaki
 * açık harflerden ayrışıyor ("TRE N DYOL", "TEK N İK", "KO N YASPOR"). Font dosyası bozuk değil (resmi
 * google/fonts sürümüyle aynı sonuç), aralık/kerning de normal — glif tasarımı küçük puntoda dolar.
 * Çözüm: `MONO_BOLD_MIN_PX` altındaki Space Mono metni Regular (400) ile çizilir; N açık kalır.
 */

export const MONO_FAMILY = "Space Mono";
/** Bu puntonun altında Space Mono Bold yerine Regular. Kartlardaki bütün Space Mono etiketleri altında kalır. */
export const MONO_BOLD_MIN_PX = 32;

interface FontContext {
  fontFamily?: string | undefined;
  fontSize?: number | undefined;
}

type Props = { children?: ReactNode; style?: CSSProperties } & Record<string, unknown>;

const isMono = (family: string | undefined) => family?.split(",")[0]?.trim().replace(/["']/g, "") === MONO_FAMILY;

/** Tek stil: miras alınan font bağlamıyla küçük Space Mono Bold → Regular. */
export function legibleMonoStyle(style: CSSProperties | undefined, inherited: FontContext = {}): CSSProperties | undefined {
  const family = typeof style?.fontFamily === "string" ? style.fontFamily : inherited.fontFamily;
  const size = typeof style?.fontSize === "number" ? style.fontSize : inherited.fontSize;
  if (!isMono(family) || size === undefined || size >= MONO_BOLD_MIN_PX) return style;
  const weight = Number(style?.fontWeight ?? 400);
  return weight > 400 || style?.fontWeight === "bold" ? { ...style, fontWeight: 400 } : style;
}

/** Çözülmüş (yalnızca yerel öğe) ağaçta küçük Space Mono Bold'u Regular'a çevirir. */
export function legibleMonoTree(node: ReactNode, inherited: FontContext = {}): ReactNode {
  if (Array.isArray(node)) return node.map((child) => legibleMonoTree(child, inherited));
  if (!isValidElement(node)) return node;
  const element = node as ReactElement<Props>;
  const { style } = element.props;
  const context: FontContext = {
    fontFamily: typeof style?.fontFamily === "string" ? style.fontFamily : inherited.fontFamily,
    fontSize: typeof style?.fontSize === "number" ? style.fontSize : inherited.fontSize,
  };
  const nextStyle = legibleMonoStyle(style, inherited);
  if (element.type === "svg" || element.props.children === undefined) return nextStyle === style ? element : cloneElement(element, { style: nextStyle });
  const children = Children.toArray(element.props.children).map((child) => legibleMonoTree(child, context));
  return cloneElement(element, nextStyle === style ? undefined : { style: nextStyle }, ...children);
}
