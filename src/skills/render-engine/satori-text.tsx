import { Children, cloneElement, Fragment, isValidElement, type ReactElement, type ReactNode } from "react";
import { ImageResponse } from "next/og";

/**
 * Satori metin katmanı — bütün kartların ORTAK giriş noktası (`renderSatori`).
 *
 * Sorun: Satori sözcüğün genişliğini çizimden biraz büyük ölçüyor; fark sözcük uzadıkça artıyor ve
 * sonraki boşluğa ekleniyor ("Trabzonspor  son", "TRENDYOL  SÜPER LİG"). Kütüphanede ayar noktası yok.
 * Çözüm: tek satırlık metinlerde boşluklar bölünmez boşluk (U+00A0) olur — satır Satori için tek
 * "sözcük"tür, ölçüm farkı yalnızca satır sonunda kalır (görünmez).
 *
 * Çok satırlı (kendiliğinden kaydırılan) paragraflar `data-wrap` işaretiyle hariç tutulur; elle satır
 * bölmek için `wrapLines`. Şablonlar saf fonksiyon bileşenleridir (hook yok): ağaç çizimden önce
 * çözülüp dönüştürülür.
 */

const NBSP = " ";

/** Tek satırlık metin: boşluklar bölünmez. */
export const tight = (text: string): string => text.replace(/ /g, NBSP);

/** Çok satırlı metin: tahmini genişliğe göre açgözlü satır bölme, her satır `tight`. */
export function wrapLines(text: string, maxWidth: number, size: number, emPerChar = 0.52): string[] {
  const perLine = Math.max(8, Math.floor(maxWidth / (size * emPerChar)));
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/u).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word;
    if (line && next.length > perLine) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines.map(tight);
}

type Props = { children?: ReactNode; "data-wrap"?: unknown } & Record<string, unknown>;

/** Ağacı çözer (fonksiyon bileşenleri çağrılır) ve `data-wrap` dışındaki metin düğümlerini sıkılaştırır. */
export function tightenTree(node: ReactNode, wrap = false): ReactNode {
  if (typeof node === "string") return wrap ? node : tight(node);
  if (typeof node === "number" || node === null || node === undefined || typeof node === "boolean") return node;
  if (Array.isArray(node)) return node.map((child) => tightenTree(child, wrap));
  if (!isValidElement(node)) return node;
  const element = node as ReactElement<Props>;
  if (typeof element.type === "function") {
    const render = element.type as (props: Props) => ReactNode;
    return tightenTree(render(element.props), wrap);
  }
  const keepWrap = wrap || element.props["data-wrap"] !== undefined;
  // svg içi (text/tspan yok) ve img: çocukları olduğu gibi.
  if (element.type === "svg" || element.props.children === undefined) return element;
  const children = Children.toArray(element.props.children).map((child) => tightenTree(child, keepWrap));
  if ((element.type as unknown) === Fragment) return <>{children}</>;
  return cloneElement(element, undefined, ...children);
}

/** Bütün kartların Satori çizimi bu fonksiyondan geçer (`new ImageResponse` doğrudan çağrılmaz). */
export function renderSatori(element: ReactElement, options: ConstructorParameters<typeof ImageResponse>[1]): ImageResponse {
  return new ImageResponse(tightenTree(element) as ReactElement, options);
}
