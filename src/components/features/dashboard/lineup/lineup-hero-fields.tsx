"use client";

import { useCallback } from "react";
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
 * (sunucu takım + formayı yeniden doğrular). Fotoğraf Vitrin hattından geçer — yüz tespiti, akıllı kırpma,
 * tonlama; "Otomatik" kaldırılınca elle kaydırma/zoom. Ücretli adım yok (kart büyütülmüş arşiv sürümünü okur).
 * Seçim değişince önizlemeyi yeniden çizin.
 */
export function LineupHeroFields({ draft, teamIds, onHeroChange }: LineupHeroFieldsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Kapak Fotoğrafı · Kahraman Liste</CardTitle>
        <CardDescription>
          Her takım için arşivden takımın kendi formalı bir fotoğraf seçin (saha oyuncusu önerilir). Yüz otomatik bulunur ve kartın sol
          bölgesine yerleştirilir; gerekirse elle ayarlayın. Fotoğrafı olmayan takım Taktik Tahtası olarak çizilir. Yeni fotoğraf:
          Kütüphane → Fotoğraf Arşivi.
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
  // Seçici her durum değişiminde çağırır: yalnızca gerçekten değişen fotoğraf forma yazılır (ayar sıfırlanır).
  const onPick = useCallback(
    (selection: PickerSelection) => {
      const photoId = selection.photoId ?? "";
      if (photoId !== team.heroPhotoId) onHeroChange(side, { heroPhotoId: photoId, heroAdjust: null });
    },
    [side, team.heroPhotoId, onHeroChange],
  );
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border/60 p-3">
      <ArchivePhotoPicker
        name={`${side}Hero`}
        label={`${team.teamName || SIDE_LABELS[side]} · kapak fotoğrafı`}
        teams={teamId ? [{ id: teamId, name: team.teamName }] : []}
        fixtureId={draft.fixtureId || null}
        kitOnly
        allowUpload={false}
        onChange={onPick}
      />
      {team.heroPhotoId ? (
        <CropAdjust
          id={`${side}-hero-adjust`}
          title="Kadraj"
          value={team.heroAdjust}
          onChange={(heroAdjust) => onHeroChange(side, { heroPhotoId: team.heroPhotoId, heroAdjust })}
          maxZoom={MAX_ZOOM}
        />
      ) : null}
    </div>
  );
}
