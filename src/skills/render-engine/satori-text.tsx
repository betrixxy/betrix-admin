import { Children, cloneElement, Fragment, isValidElement, type ReactElement, type ReactNode } from "react";
import { ImageResponse } from "next/og";
import { legibleMonoTree } from "./satori-mono";

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

const NBSP = String.fromCharCode(0xa0);

/** Tek satırlık metin: boşluklar bölünmez. */
export const tight = (text: string): string => text.replace(/ /g, NBSP);

/**
 * Çok satırlı metin: tahmini genişliğe göre açgözlü satır bölme, her satır `tight`. Genişlik em
 * cinsinden: boşluk olmayan karakter `emPerChar`, boşluk `spaceEm` (verilmezse aynı).
 */
export function wrapLines(text: string, maxWidth: number, size: number, emPerChar = 0.52, spaceEm = emPerChar): string[] {
  const em = (value: string) => [...value].reduce((sum, char) => sum + (/\s/u.test(char) ? spaceEm : emPerChar), 0);
  const limit = Math.max(8 * emPerChar, maxWidth / size);
  const lines: string[] = [];
  let line = "";
  let gap = "";
  // Boşluk dizileri korunur ("  ·  " künye ayıracı); satır sonuna düşen boşluk atılır.
  for (const [, word = "", space = ""] of text.trim().matchAll(/(\S+)(\s*)/gu)) {
    const next = line ? `${line}${gap}${word}` : word;
    if (line && em(next) > limit) {
      lines.push(line);
      line = word;
    } else line = next;
    gap = space;
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

/**
 * Bütün kartların Satori çizimi bu fonksiyondan geçer (`new ImageResponse` doğrudan çağrılmaz). Ağaç
 * sıkılaştırılır, küçük punto Space Mono Bold Regular'a çevrilir (bkz. `satori-mono.ts`).
 */
export function renderSatori(element: ReactElement, options: ConstructorParameters<typeof ImageResponse>[1]): ImageResponse {
  return new ImageResponse(legibleMonoTree(tightenTree(element)) as ReactElement, options);
}
