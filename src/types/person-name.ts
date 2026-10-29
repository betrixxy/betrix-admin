import type { NameOrigin } from "@/lib/dashboard/name-case";

/** Sportmonks kişi kaydı (oyuncu kadrosu ya da teknik direktör) — Türkçe karakterli ad + uyruk. */
export interface SportmonksPerson {
  displayName: string;
  firstname: string;
  lastname: string;
  /** Sportmonks ülke adı ("Turkey", "Nigeria"); bilinmiyorsa null. */
  nationality: string | null;
  jersey: number | null;
}

/** Kart adının kaynağı — öncelik sırasıyla (bkz. `lib/names/person-name.ts::cardPersonName`). */
export type PersonNameSource = "override" | "sportmonks" | "api";

export interface CardPersonName {
  /** Kartta yazılacak ad (büyük harfe çevrilmeden): "U. Çakır". */
  name: string;
  /** Büyük harf kökeni (`upperName` ipucu): adın harfi → uyruk → takım. */
  origin: NameOrigin | null;
  source: PersonNameSource;
}
