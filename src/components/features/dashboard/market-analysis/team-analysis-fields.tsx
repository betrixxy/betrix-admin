"use client";

import { CircleAlert, CircleCheck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { KeyPlayerDraft, StatTileDraft, TeamAnalysisDraft } from "@/types/deep-analysis";

interface TeamAnalysisFieldsProps {
  /** Alan kimliklerinin öneki — iki takımın formu aynı sayfada. */
  idPrefix: string;
  value: TeamAnalysisDraft;
  opponentName: string;
  onChange: (next: TeamAnalysisDraft) => void;
}

/** CheckMatch yeşili (tokens.css `--cm-green`) — renk seçilmediğinde kartın kullandığı parıltı. */
const BRAND_GREEN = "#22c24e";

function replaceAt<T>(items: T[], index: number, item: T): T[] {
  return items.map((current, i) => (i === index ? item : current));
}

function PointFields({
  id,
  label,
  icon,
  points,
  placeholder,
  onChange,
}: {
  id: string;
  label: string;
  icon: React.ReactNode;
  points: string[];
  placeholder: string;
  onChange: (points: string[]) => void;
}) {
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="mb-1.5 flex items-center gap-1.5 text-sm font-medium">
        {icon}
        {label}
      </legend>
      {points.map((point, index) => (
        <Input
          key={index}
          id={`${id}-${index}`}
          aria-label={`${label} ${index + 1}`}
          value={point}
          maxLength={120}
          placeholder={index === 0 ? placeholder : "İsteğe bağlı"}
          onChange={(event) => onChange(replaceAt(points, index, event.target.value))}
        />
      ))}
    </fieldset>
  );
}

function PlayerFields({ id, players, onChange }: { id: string; players: KeyPlayerDraft[]; onChange: (players: KeyPlayerDraft[]) => void }) {
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="mb-1.5 text-sm font-medium">Anahtar Oyuncular</legend>
      {players.map((player, index) => (
        <div key={index} className="grid grid-cols-[2rem_1fr_1.4fr] items-center gap-2">
          {player.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- API-Football oyuncu fotoğrafı, harici küçük önizleme.
            <img src={player.photoUrl} alt="" className="size-8 rounded-full bg-white/5 object-cover" />
          ) : (
            <span className="size-8 rounded-full bg-white/5" />
          )}
          <Input
            id={`${id}-name-${index}`}
            aria-label={`Oyuncu ${index + 1} adı`}
            value={player.name}
            maxLength={40}
            placeholder="Oyuncu adı"
            onChange={(event) => onChange(replaceAt(players, index, { ...player, name: event.target.value }))}
          />
          <Input
            aria-label={`Oyuncu ${index + 1} taktiksel rolü`}
            value={player.role}
            maxLength={60}
            placeholder="Taktiksel rol"
            onChange={(event) => onChange(replaceAt(players, index, { ...player, role: event.target.value }))}
          />
        </div>
      ))}
    </fieldset>
  );
}

function StatFields({ stats, onChange }: { stats: StatTileDraft[]; onChange: (stats: StatTileDraft[]) => void }) {
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="mb-1.5 text-sm font-medium">İstatistik Bloğu</legend>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {stats.map((stat, index) => (
          <div key={index} className="flex flex-col gap-1 rounded-lg border border-border/60 p-2">
            <Input
              aria-label={`İstatistik ${index + 1} etiketi`}
              value={stat.label}
              maxLength={24}
              className="h-7 text-xs"
              onChange={(event) => onChange(replaceAt(stats, index, { ...stat, label: event.target.value }))}
            />
            <Input
              aria-label={`İstatistik ${index + 1} değeri`}
              value={stat.value}
              maxLength={10}
              className="h-8 text-base font-semibold tabular-nums"
              onChange={(event) => onChange(replaceAt(stats, index, { ...stat, value: event.target.value }))}
            />
          </div>
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground">
        API-Football &quot;başarılı pres&quot; verisi sunmaz; &quot;Top Kazanma&quot; = maç başı müdahale + top kesme.
      </p>
    </fieldset>
  );
}

/** Tek takımın analiz kartı alanları — öneriler veriden gelir, hepsi düzenlenebilir. */
export function TeamAnalysisFields({ idPrefix, value, opponentName, onChange }: TeamAnalysisFieldsProps) {
  const set = <K extends keyof TeamAnalysisDraft>(key: K, next: TeamAnalysisDraft[K]) => onChange({ ...value, [key]: next });

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <Label htmlFor={`${idPrefix}-color`}>Takım rengi</Label>
        <Input
          id={`${idPrefix}-color`}
          type="color"
          value={value.colorHex || BRAND_GREEN}
          onChange={(event) => set("colorHex", event.target.value)}
          className="h-8 w-14 p-1"
        />
        <span className="text-xs text-muted-foreground">Kartın üst ve alt kenarındaki parıltı — boş bırakılırsa CheckMatch yeşili.</span>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <PointFields
          id={`${idPrefix}-strengths`}
          label="Güçlü Yönler"
          icon={<CircleCheck className="size-4 text-emerald-400" />}
          points={value.strengths}
          placeholder="Ör. Duran toplarda etkili"
          onChange={(points) => set("strengths", points)}
        />
        <PointFields
          id={`${idPrefix}-cautions`}
          label="Dikkat Edilmesi Gerekenler"
          icon={<CircleAlert className="size-4 text-amber-400" />}
          points={value.cautions}
          placeholder="Ör. Geçiş savunmasında boşluk"
          onChange={(points) => set("cautions", points)}
        />
      </div>

      <PlayerFields id={`${idPrefix}-player`} players={value.keyPlayers} onChange={(players) => set("keyPlayers", players)} />

      <StatFields stats={value.stats} onChange={(stats) => set("stats", stats)} />

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${idPrefix}-approach`}>{opponentName ? `${opponentName} karşısında önerilen yaklaşım` : "Önerilen yaklaşım"}</Label>
        <Textarea
          id={`${idPrefix}-approach`}
          rows={3}
          maxLength={400}
          value={value.approach}
          placeholder="Taktiksel analiz: rakibin açıkları, oyun planı…"
          onChange={(event) => set("approach", event.target.value)}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${idPrefix}-quote`}>Alıntı / yorum (kartın altı)</Label>
        <Textarea
          id={`${idPrefix}-quote`}
          rows={2}
          maxLength={240}
          value={value.quote}
          placeholder="Ör. “Bu maçın anahtarı orta saha mücadelesi olacak.”"
          onChange={(event) => set("quote", event.target.value)}
        />
      </div>
    </div>
  );
}
