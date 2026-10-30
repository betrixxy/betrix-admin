/** Onaysız vitrin dosyası kuralı — saf kısım (sorgu `vitrin-files.ts`; birim test edilebilir). */

/** Dosya adresinden servis edilen vitrin durumları. */
export const SERVABLE_STATUSES = new Set(["APPROVED", "PUBLISHED"]);

export interface VitrinFileOwner {
  status: string;
  renderOptions: unknown;
}

const isVitrin = (renderOptions: unknown): boolean =>
  typeof renderOptions === "object" && renderOptions !== null && (renderOptions as { kind?: unknown }).kind === "VITRIN";

/** Saf: dosya bir vitrine aitse ve o vitrin onaylı/yayınlanmış değilse true (reddedilir). */
export function vitrinFileBlocked(owners: VitrinFileOwner[]): boolean {
  return owners.some((owner) => isVitrin(owner.renderOptions) && !SERVABLE_STATUSES.has(owner.status));
}

/** LIKE kalıbında harfiyen: `%`, `_` ve `\` kaçışlanır (dosya adında `_` olabilir). */
export const likeLiteral = (value: string): string => value.replace(/[\\%_]/g, (char) => `\\${char}`);
