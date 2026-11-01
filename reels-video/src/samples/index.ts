import { buildSampleScript, type ContractSample } from "./build-script";

/** İki KURGUSAL örnek: takımlar, kişiler ve sayılar uydurmadır. Biri derbi havası, biri ezici favori. */

const derby: ContractSample = {
  contract_version: "1.0",
  match: { id: 900001, kickoff_utc: "2026-11-08T17:00:00Z", league: { id: 203, name: "Kurgu Ligi", round: "11. Hafta" }, referee: "Kurgu Hakem" },
  teams: { home: { id: 9001, name: "Boğaziçi SK", logo_url: null }, away: { id: 9002, name: "Anadolu Gücü", logo_url: null } },
  model: { version: "2.1.0", computed_at: "2026-11-08T08:00:00Z", simulations: 500000 },
  outcome: { home_win: 0.38, draw: 0.3, away_win: 0.32 },
  goals: { three_plus: 0.57 },
  both_score: 0.62,
  first_goal: { home: 0.46, away: 0.44, none: 0.1 },
};

const favourite: ContractSample = {
  contract_version: "1.0",
  match: { id: 900002, kickoff_utc: "2026-11-09T17:00:00Z", league: { id: 203, name: "Kurgu Ligi", round: "11. Hafta" }, referee: "Kurgu Hakem" },
  teams: { home: { id: 9003, name: "Kuzey Yıldızı", logo_url: null }, away: { id: 9004, name: "Liman Spor", logo_url: null } },
  model: { version: "2.1.0", computed_at: "2026-11-09T08:00:00Z", simulations: 500000 },
  outcome: { home_win: 0.74, draw: 0.17, away_win: 0.09 },
  goals: { three_plus: 0.71 },
  both_score: 0.41,
  first_goal: { home: 0.68, away: 0.23, none: 0.09 },
};

export const SAMPLES = {
  "reel-derbi": buildSampleScript(derby, {
    colors: { home: { primary: "#E2263F", secondary: "#FFD6DB" }, away: { primary: "#2F80ED", secondary: "#D5E7FF" } },
    logos: { home: "placeholders/crest-bogazici.svg", away: "placeholders/crest-anadolu.svg" },
  }),
  "reel-favori": buildSampleScript(favourite, {
    colors: { home: { primary: "#F5B700", secondary: "#FFF0C2" }, away: { primary: "#9B5DE5", secondary: "#E9DBFA" } },
    logos: { home: "placeholders/crest-kuzey.svg", away: "placeholders/crest-liman.svg" },
  }),
};

export type SampleId = keyof typeof SAMPLES;
