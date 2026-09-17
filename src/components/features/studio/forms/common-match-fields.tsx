import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function CommonMatchFields() {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="home-team">Ev Sahibi Takım</Label>
        <Input id="home-team" placeholder="örn. Galatasaray" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="away-team">Deplasman Takım</Label>
        <Input id="away-team" placeholder="örn. Fenerbahçe" />
      </div>
    </div>
  );
}
