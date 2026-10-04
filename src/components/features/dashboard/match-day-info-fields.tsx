"use client";

import { X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Formda düzenlenebilir maç künyesi — maç seçilince otomatik dolar, sonra elle değiştirilebilir. */
export interface MatchDayInfoValues {
  homeTeam: string;
  awayTeam: string;
  homeLogo: string;
  awayLogo: string;
  leagueLogo: string;
  league: string;
  week: string;
  date: string;
  time: string;
  stadium: string;
  referee: string;
}

export const EMPTY_MATCH_DAY_INFO: MatchDayInfoValues = {
  homeTeam: "",
  awayTeam: "",
  homeLogo: "",
  awayLogo: "",
  leagueLogo: "",
  league: "Süper Lig",
  week: "",
  date: "",
  time: "",
  stadium: "",
  referee: "",
};

interface MatchDayInfoFieldsProps {
  values: MatchDayInfoValues;
  onChange: (values: MatchDayInfoValues) => void;
}

type TextKey = Exclude<keyof MatchDayInfoValues, "homeLogo" | "awayLogo" | "leagueLogo">;

const TEXT_FIELDS: { key: TextKey; label: string; type?: string; placeholder?: string }[] = [
  { key: "league", label: "Lig", placeholder: "Süper Lig" },
  { key: "week", label: "Hafta", placeholder: "3" },
  { key: "date", label: "Tarih", type: "date" },
  { key: "time", label: "Saat", type: "time" },
  { key: "stadium", label: "Stadyum", placeholder: "RAMS Park" },
  { key: "referee", label: "Hakem", placeholder: "Henüz açıklanmadı" },
];

function TeamField({
  side,
  values,
  onChange,
}: MatchDayInfoFieldsProps & { side: "home" | "away" }) {
  const nameKey = side === "home" ? "homeTeam" : "awayTeam";
  const logoKey = side === "home" ? "homeLogo" : "awayLogo";
  const logo = values[logoKey];
  const inputId = `match-day-${nameKey}`;

  return (
    <div className="flex items-end gap-3">
      <div className="flex size-14 shrink-0 items-center justify-center rounded-lg bg-muted/30 ring-1 ring-border">
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logo} alt="" className="size-11 object-contain" />
        ) : (
          <span className="text-[10px] text-muted-foreground">logo yok</span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1.5">
        <Label htmlFor={inputId}>{side === "home" ? "Ev sahibi" : "Deplasman"}</Label>
        <Input
          id={inputId}
          name={nameKey}
          required
          maxLength={40}
          value={values[nameKey]}
          onChange={(event) => onChange({ ...values, [nameKey]: event.target.value })}
        />
      </div>
      <input type="hidden" name={logoKey} value={logo} />
      {logo ? (
        <button
          type="button"
          title="Logoyu kaldır"
          className="mb-2 text-muted-foreground hover:text-white"
          onClick={() => onChange({ ...values, [logoKey]: "" })}
        >
          <X className="size-3.5" />
        </button>
      ) : null}
    </div>
  );
}

export function MatchDayInfoFields({ values, onChange }: MatchDayInfoFieldsProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <TeamField side="home" values={values} onChange={onChange} />
        <TeamField side="away" values={values} onChange={onChange} />
      </div>
      <input type="hidden" name="leagueLogo" value={values.leagueLogo} />
      <div className="grid gap-4 sm:grid-cols-3">
        {TEXT_FIELDS.map((field) => (
          <div key={field.key} className="flex flex-col gap-1.5">
            <Label htmlFor={`match-day-${field.key}`} className="flex items-center gap-1.5">
              {field.key === "league" && values.leagueLogo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={values.leagueLogo} alt="" className="size-4 rounded-sm bg-white object-contain p-px" />
              ) : null}
              {field.label}
            </Label>
            <Input
              id={`match-day-${field.key}`}
              name={field.key}
              type={field.type ?? "text"}
              placeholder={field.placeholder}
              value={values[field.key]}
              onChange={(event) => onChange({ ...values, [field.key]: event.target.value })}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
