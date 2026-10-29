"use client";

import { useCallback, useRef, useState, useTransition } from "react";
import { AlertCircle, LoaderCircle, Upload } from "lucide-react";
import { uploadLineupHeroAction } from "@/app/dashboard/studio/lineup/actions";
import { Button } from "@/components/ui/button";
import { runGuarded } from "@/hooks/use-action-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArchivePhotoPicker, type PickerSelection } from "@/components/features/archive/archive-photo-picker";
import { CropAdjust } from "@/components/features/dashboard/player-h2h/crop-adjust";
import type { TeamSide } from "@/types/deep-analysis";
import type { LineupDraft, TeamLineupDraft } from "@/types/lineup";

interface LineupHeroFieldsProps {
  draft: LineupDraft;
  /** Seçili maçtaki takımların API-Football kimlikleri — seçici her tarafta o takımın arşivini açar. */
  teamIds: Record<TeamSide, number | null>;
  onHeroChange: (side: TeamSide, hero: Pick<TeamLineupDraft, "heroPhotoId" | "heroAdjust">) => void;
}

const SIDE_LABELS: Record<TeamSide, string> = { home: "Ev sahibi", away: "Deplasman" };

/** Vitrin/Oyuncu Karşılaştırması ile aynı elle ayar sınırı. */
const MAX_ZOOM = 2;

/**
 * Kahraman Liste kapağı: her takım için Fotoğraf Arşivi'nden yalnızca O TAKIMIN KENDİ formalı fotoğrafları
 * (sunucu takım + formayı yeniden doğrular). "Yeni yükle": fotoğraf arşive o takım ve seçilen kişiyle
 * etiketlenerek girer (forma takımı yine o takım olmalı), sonra seçili gelir. Fotoğraf Vitrin hattından
 * geçer — yüz tespiti, akıllı kırpma, tonlama; "Otomatik" kaldırılınca elle kaydırma/zoom. Ücretli adım yok.
 */
export function LineupHeroFields({ draft, teamIds, onHeroChange }: LineupHeroFieldsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Kapak Fotoğrafı · Kahraman Liste</CardTitle>
        <CardDescription>
          Her takım için arşivden takımın kendi formalı bir fotoğraf seçin ya da yeni yükleyin (saha oyuncusu önerilir). Yüz otomatik
          bulunur ve kartın sol bölgesine yerleştirilir; gerekirse elle ayarlayın. Fotoğrafı olmayan takım Taktik Tahtası olarak çizilir.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5 md:grid-cols-2">
        {(["home", "away"] as const).map((side) => (
          <HeroSide key={side} side={side} draft={draft} teamId={teamIds[side]} onHeroChange={onHeroChange} />
        ))}
      </CardContent>
    </Card>
  );
}

function HeroSide({ side, draft, teamId, onHeroChange }: { side: TeamSide; draft: LineupDraft; teamId: number | null; onHeroChange: LineupHeroFieldsProps["onHeroChange"] }) {
  const team = draft[side];
  const formRef = useRef<HTMLFormElement>(null);
  const [uploadMode, setUploadMode] = useState(false);
  const [reload, setReload] = useState<{ key: number; selectPhotoId: string | null } | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, startUploading] = useTransition();

  // Seçici her durum değişiminde çağırır: yalnızca gerçekten değişen fotoğraf forma yazılır (ayar sıfırlanır).
  const onPick = useCallback(
    (selection: PickerSelection) => {
      setUploadMode(selection.upload);
      const photoId = selection.photoId ?? "";
      if (photoId !== team.heroPhotoId) onHeroChange(side, { heroPhotoId: photoId, heroAdjust: null });
    },
    [side, team.heroPhotoId, onHeroChange],
  );

  function upload() {
    if (!formRef.current) return;
    const formData = new FormData(formRef.current);
    formData.set("side", side);
    formData.set("fixtureId", draft.fixtureId);
    setError(null);
    startUploading(() => runGuarded(async () => {
      const result = await uploadLineupHeroAction(formData);
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      // Arşiv yeniden yüklenir, yeni fotoğraf seçili gelir (seçici onu forma bildirir).
      setReload((current) => ({ key: (current?.key ?? 0) + 1, selectPhotoId: result.data.photoId }));
    }, setError, formData));
  }

  return (
    <form ref={formRef} onSubmit={(event) => event.preventDefault()} className="flex flex-col gap-2 rounded-lg border border-border/60 p-3">
      <ArchivePhotoPicker
        name={`${side}Hero`}
        label={`${team.teamName || SIDE_LABELS[side]} · kapak fotoğrafı`}
        teams={teamId ? [{ id: teamId, name: team.teamName }] : []}
        fixtureId={draft.fixtureId || null}
        kitOnly
        reload={reload}
        onChange={onPick}
      />
      {uploadMode ? (
        <Button type="button" size="sm" onClick={upload} disabled={isUploading || !draft.fixtureId}>
          {isUploading ? <LoaderCircle className="animate-spin" /> : <Upload />}
          {isUploading ? "Arşive yükleniyor…" : "Arşive yükle ve seç"}
        </Button>
      ) : null}
      {error ? (
        <p className="flex items-center gap-1.5 text-xs text-destructive" role="alert">
          <AlertCircle className="size-3.5 shrink-0" />
          {error}
        </p>
      ) : null}
      {team.heroPhotoId && !uploadMode ? (
        <CropAdjust
          id={`${side}-hero-adjust`}
          title="Kadraj"
          value={team.heroAdjust}
          onChange={(heroAdjust) => onHeroChange(side, { heroPhotoId: team.heroPhotoId, heroAdjust })}
          maxZoom={MAX_ZOOM}
        />
      ) : null}
    </form>
  );
}
