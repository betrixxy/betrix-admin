"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { FORMATION_OPTIONS, LINE_LABELS, formationGroups } from "@/lib/dashboard/lineup-formations";
import { SQUAD_POSITIONS, type LineupSlot, type SquadPlayer, type TeamLineupDraft } from "@/types/lineup";

interface TeamLineupFieldsProps {
  idPrefix: string;
  value: TeamLineupDraft;
  squad: SquadPlayer[];
  onChange: (next: TeamLineupDraft) => void;
}

const NO_POSITION_LABEL = "Diğer";

/**
 * Tek takımın dizilişi + 11 pozisyon. Pozisyonlar dizilişin satır sırasıyla (kaleci → forvet,
 * satır içinde soldan sağa) listelenir; diziliş değişince oyuncular aynı sırayla yeni yerlere akar.
 */
export function TeamLineupFields({ idPrefix, value, squad, onChange }: TeamLineupFieldsProps) {
  const groups = formationGroups(value.formation);
  const formations = FORMATION_OPTIONS.some((f) => f === value.formation) ? FORMATION_OPTIONS : [value.formation, ...FORMATION_OPTIONS];
  const squadById = new Map(squad.map((player) => [player.id, player]));
  const usedIds = new Set(value.slots.map((slot) => slot.playerId).filter((id): id is number => id !== null));

  function setSlot(index: number, next: LineupSlot) {
    onChange({ ...value, slots: value.slots.map((slot, i) => (i === index ? next : slot)) });
  }

  function pickPlayer(index: number, rawId: string) {
    const player = rawId ? squadById.get(Number(rawId)) : undefined;
    setSlot(index, player ? { playerId: player.id, name: player.name, number: player.number !== null ? String(player.number) : "" } : { playerId: null, name: "", number: "" });
  }

  const byPosition = [...SQUAD_POSITIONS, null].map((position) => ({
    label: position ? LINE_LABELS[position] : NO_POSITION_LABEL,
    players: squad.filter((player) => player.position === position),
  }));

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${idPrefix}-formation`}>Diziliş</Label>
          <NativeSelect id={`${idPrefix}-formation`} value={value.formation} onChange={(event) => onChange({ ...value, formation: event.target.value })}>
            {formations.map((formation) => (
              <option key={formation} value={formation}>
                {formation}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${idPrefix}-color`}>Forma rengi</Label>
          <div className="flex items-center gap-2">
            <input
              id={`${idPrefix}-color`}
              type="color"
              value={value.colorHex || "#22c24e"}
              onChange={(event) => onChange({ ...value, colorHex: event.target.value })}
              className="h-8 w-10 cursor-pointer rounded border border-input bg-transparent"
            />
            <span className="font-mono text-xs text-muted-foreground">{value.colorHex || "marka yeşili"}</span>
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${idPrefix}-coach`}>Teknik direktör</Label>
          <Input id={`${idPrefix}-coach`} value={value.coach} maxLength={60} onChange={(event) => onChange({ ...value, coach: event.target.value })} />
        </div>
      </div>

      {groups.map((group) => (
        <fieldset key={`${group.role}-${group.indexes[0]}`} className="flex flex-col gap-2 rounded-lg border border-border/60 p-3">
          <legend className="px-1 text-xs font-semibold uppercase tracking-wider text-emerald-300">
            {LINE_LABELS[group.role]} <span className="text-muted-foreground">({group.indexes.length})</span>
          </legend>
          {group.indexes.map((index, order) => {
            const slot = value.slots[index] ?? { playerId: null, name: "", number: "" };
            const duplicate = slot.playerId !== null && value.slots.filter((s) => s.playerId === slot.playerId).length > 1;
            return (
              <div key={index} className="grid grid-cols-[1fr_4rem_1fr] items-center gap-2">
                <NativeSelect
                  aria-label={`${LINE_LABELS[group.role]} ${order + 1} — kadrodan seç`}
                  value={slot.playerId !== null && squadById.has(slot.playerId) ? String(slot.playerId) : ""}
                  onChange={(event) => pickPlayer(index, event.target.value)}
                  className={duplicate ? "border-destructive" : undefined}
                >
                  <option value="">{squad.length ? "Kadrodan seç…" : "Kadro yok — elle yazın"}</option>
                  {byPosition
                    .filter((bucket) => bucket.players.length > 0)
                    .map((bucket) => (
                      <optgroup key={bucket.label} label={bucket.label}>
                        {bucket.players.map((player) => (
                          <option key={player.id} value={player.id}>
                            {player.number !== null ? `${player.number} · ` : ""}
                            {player.name}
                            {usedIds.has(player.id) && player.id !== slot.playerId ? " ✓" : ""}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                </NativeSelect>
                <Input
                  aria-label="Forma numarası"
                  inputMode="numeric"
                  maxLength={2}
                  value={slot.number}
                  onChange={(event) => setSlot(index, { ...slot, number: event.target.value.replace(/\D/g, "") })}
                />
                <Input
                  aria-label="Kartta görünecek isim"
                  maxLength={40}
                  value={slot.name}
                  // Kartta görünen adı kısaltmak ("M. Salah" → "Salah") kadro seçimini bozmaz.
                  onChange={(event) => setSlot(index, { ...slot, name: event.target.value })}
                />
              </div>
            );
          })}
        </fieldset>
      ))}
      <p className="text-xs text-muted-foreground">
        Satır içinde sıra soldan sağadır (ör. savunmada sol bek → sağ bek). ✓ işaretli oyuncular başka bir pozisyonda zaten seçili.
      </p>
    </div>
  );
}
