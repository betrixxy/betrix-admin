import { DEFAULT_STAT_SELECTION } from "@/lib/dashboard/studio-stats";
import type { DraftStatSelection } from "@/types/draft";

const FIELDS: { name: keyof DraftStatSelection; label: string }[] = [
  { name: "includeForm", label: "Son 5 maç formu" },
  { name: "includeGoals", label: "Atılan / yenilen gol (maç başı)" },
  { name: "includeXg", label: "xG / xGA (maç başı, varsa)" },
  { name: "includeHeadToHead", label: "Aralarındaki son maçlar" },
];

interface StatSelectionFieldsProps {
  defaults?: DraftStatSelection;
  disabled?: boolean;
}

/** Görselin veri katmanına girecek gerçek istatistikler — stüdyo ve taslak inceleme formlarında ortak. */
export function StatSelectionFields({ defaults = DEFAULT_STAT_SELECTION, disabled = false }: StatSelectionFieldsProps) {
  return (
    <fieldset className="flex flex-col gap-2" disabled={disabled}>
      <legend className="mb-1 text-sm font-medium">Görsele eklenecek maç istatistikleri</legend>
      {FIELDS.map((field) => (
        <label key={field.name} className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name={field.name}
            defaultChecked={defaults[field.name]}
            className="size-4 accent-emerald-500"
          />
          {field.label}
        </label>
      ))}
    </fieldset>
  );
}
