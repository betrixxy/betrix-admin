import type { NameOrigin } from "@/lib/dashboard/name-case";

/** Sportmonks kişi kaydı (oyuncu kadrosu ya da teknik direktör) — Türkçe karakterli ad + uyruk. */
export interface SportmonksPerson {
  /**
   * Yaygın ad (`display_name`, yoksa `common_name`): "Vinícius Júnior", "Uğurcan Çakır". Resmi tam ad
   * (`firstname` + `lastname`) buraya ASLA girmez; yaygın ad yoksa null.
   */
  displayName: string | null;
  /** Resmi ad alanları — yalnızca eşleme ve harf geri yükleme için, kartta yazılmaz. */
  firstname: string;
  lastname: string;
  /** Sportmonks ülke adı ("Turkey", "Nigeria"); bilinmiyorsa null. */
  nationality: string | null;
  jersey: number | null;
}

/** Kart adının kaynağı — öncelik sırasıyla (bkz. `lib/names/person-name.ts::cardPersonName`). */
export type PersonNameSource = "override" | "sportmonks" | "api";

export interface CardPersonName {
  /** Kartta yazılacak ad (büyük harfe çevrilmeden): "Uğurcan Çakır", eşleşme yoksa soyad "Mbangula". */
  name: string;
  /** Büyük harf kökeni (`upperName` ipucu): adın harfi → uyruk → takım. */
  origin: NameOrigin | null;
  source: PersonNameSource;
  /** Güvenilir yaygın ad mı (admin düzeltmesi ya da Sportmonks yaygın adı, baş harfsiz) — posterde ilk ad yalnızca o zaman yazılır. */
  reliable: boolean;
}
