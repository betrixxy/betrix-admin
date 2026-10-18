import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PlayerUploadDropzone } from "@/components/features/studio/player-upload-dropzone";
import { MATCH_IMPORTANCE_OPTIONS } from "@/types/sports";

export function MatchDayForm() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="derby-intensity">Maç önemi</Label>
        <Select defaultValue="NONE">
          <SelectTrigger id="derby-intensity" className="w-full">
            <SelectValue placeholder="Maç önemini seç" />
          </SelectTrigger>
          <SelectContent>
            {MATCH_IMPORTANCE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 flex flex-col gap-1.5">
          <Label htmlFor="predicted-score">Tahmini Skor</Label>
          <Input id="predicted-score" placeholder="örn. 2 - 1" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="xg-home">xG (Ev Sahibi)</Label>
          <Input id="xg-home" type="number" step="0.1" placeholder="1.8" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="xg-away">xG (Deplasman)</Label>
          <Input id="xg-away" type="number" step="0.1" placeholder="1.2" />
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <span className="text-xs font-medium text-muted-foreground">
          Yıldız Oyuncu Fotoğrafları
        </span>
        <div className="grid grid-cols-2 gap-3">
          <PlayerUploadDropzone
            label="Ev Sahibi Yıldız Oyuncu"
            exampleHint="Victor Osimhen"
          />
          <PlayerUploadDropzone
            label="Deplasman Yıldız Oyuncu"
            exampleHint="Dušan Vlahović"
          />
        </div>
      </div>
    </div>
  );
}
