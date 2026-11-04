import { Panel, useEnter } from "../design/kit";
import { labelStyle, type Theme } from "../design/tokens";
import type { ReasonData } from "../schema";

function Line({ theme, text, index, start, size }: { theme: Theme; text: string; index: number; start: number; size: number }) {
  const enter = useEnter(start + index * 12, 14);
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "flex-start", ...enter }}>
      <span style={{ width: 14, height: 14, marginTop: Math.round(size * 0.36), flexShrink: 0, background: theme.accent, borderRadius: theme.id === "A" || theme.id === "D" ? 0 : 7 }} />
      <span data-bullet="" style={{ ...labelStyle(theme, size), color: theme.ink, lineHeight: 1.14 }}>{text}</span>
    </div>
  );
}

/** Ekran maddeleri: rakam + en fazla 8 sözcük. Anlatım seslendirmede. Boş kalan alanı doldurmak için büyür. */
export function ReasonList({ theme, heading, items, start = 40, size = 46, grow = true }: { theme: Theme; heading?: string; items: readonly Pick<ReasonData, "id" | "text">[]; start?: number; size?: number; grow?: boolean }) {
  if (!items.length) return null;
  return (
    <Panel theme={theme} name={heading ?? "yorum"} style={{ display: "flex", flexDirection: "column", justifyContent: "space-evenly", gap: 12, padding: "16px 18px", flex: grow ? 1 : undefined }}>
      {heading ? <div style={{ ...labelStyle(theme, 40), color: theme.accentText, fontWeight: 800, textTransform: theme.titleUpper ? "uppercase" : "none" }}>{heading}</div> : null}
      {items.map((item, index) => <Line key={item.id} theme={theme} text={item.text} index={index} start={start} size={size} />)}
    </Panel>
  );
}
