export type TemplateId =
  | "match-day"
  | "ai-prediction"
  | "team-analysis"
  | "lineup";

export interface TemplateDef {
  id: TemplateId;
  label: string;
  description: string;
}

export type TournamentId =
  | "ucl"
  | "uel"
  | "uecl"
  | "super-lig"
  | "premier-league";

export interface TournamentTheme {
  id: TournamentId;
  label: string;
  shortLabel: string;
  /** Ana marka rengi — kart temasını ve UI vurgu rengini belirler */
  primary: string;
  /** İkincil/gradient rengi */
  secondary: string;
}

export type MatchSide = "home" | "away";

export type FormationId = "4-3-3" | "4-4-2" | "4-2-3-1" | "3-5-2";
