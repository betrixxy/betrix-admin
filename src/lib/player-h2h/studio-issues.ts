/**
 * Oyuncu karşılaştırma stüdyosunda Önizle/Kaydet'i pasif bırakan nedenler — saf, istemcide de çalışır.
 * Her neden okunur tek satır; boş dizi = butonlar etkin.
 */

export interface H2HStudioState {
  /** "match": maçtan başla · "free": serbest. */
  start: "match" | "free";
  fixtureId: string | null;
  /** Maç bilgisi/önerileri yükleniyor ya da yüklenemedi. */
  matchLoading: boolean;
  left: string | null;
  right: string | null;
  /** Veri ve uyarılar yükleniyor. */
  analyzing: boolean;
  /** Sunucunun ret nedeni (kaleci × saha oyuncusu, veri yok…); yoksa null. */
  analysisError: string | null;
  busy: boolean;
}

export function h2hStudioIssues(state: H2HStudioState): string[] {
  const issues: string[] = [];
  if (state.start === "match" && !state.fixtureId) issues.push("Maçtan başlamak için maçı seçin (ya da serbest moda geçin).");
  if (state.start === "match" && state.fixtureId && state.matchLoading) issues.push("Maçın takımları ve öneriler yükleniyor.");
  if (!state.left) issues.push("Soldaki oyuncuyu seçin.");
  if (!state.right) issues.push("Sağdaki oyuncuyu seçin.");
  if (state.left && state.right && state.left.split(":")[0] === state.right.split(":")[0]) issues.push("Aynı oyuncu iki tarafta seçili.");
  if (state.analyzing) issues.push("Oyuncu verisi yükleniyor.");
  if (state.analysisError) issues.push(state.analysisError);
  if (state.busy) issues.push("Bir işlem sürüyor — bitmesini bekleyin.");
  return [...new Set(issues)];
}
