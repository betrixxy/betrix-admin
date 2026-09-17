import type { TournamentId, TournamentTheme } from "@/types/studio";

export const TOURNAMENTS: TournamentTheme[] = [
  {
    id: "ucl",
    label: "UEFA Şampiyonlar Ligi",
    shortLabel: "UCL",
    primary: "#1A2CE0",
    secondary: "#C9D3E0",
  },
  {
    id: "uel",
    label: "UEFA Avrupa Ligi",
    shortLabel: "UEL",
    primary: "#FF6B00",
    secondary: "#FFD9B3",
  },
  {
    id: "uecl",
    label: "UEFA Konferans Ligi",
    shortLabel: "UECL",
    primary: "#00A651",
    secondary: "#B6F5D8",
  },
  {
    id: "super-lig",
    label: "Trendyol Süper Lig",
    shortLabel: "Süper Lig",
    primary: "#E30613",
    secondary: "#FFC1C1",
  },
  {
    id: "premier-league",
    label: "Premier Lig",
    shortLabel: "Premier Lig",
    primary: "#3D0A5B",
    secondary: "#D9B3F0",
  },
];

export function getTournament(id: TournamentId): TournamentTheme {
  const tournament = TOURNAMENTS.find((t) => t.id === id);
  if (!tournament) throw new Error(`Bilinmeyen turnuva: ${id}`);
  return tournament;
}
