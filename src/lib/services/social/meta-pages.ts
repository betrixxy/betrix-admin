import { z } from "zod";

/**
 * Meta Sayfa listelerinin ham şeması ve saf yardımcıları (ağ çağrısı yok — `meta-accounts.ts` kullanır).
 * `/me/accounts`, `/{business-id}/owned_pages` ve `/{business-id}/client_pages` aynı biçimi döner.
 */

export const META_PAGE_FIELDS = "id,name,instagram_business_account{id,username}";

export const metaPageSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  instagram_business_account: z.object({ id: z.string(), username: z.string().optional() }).optional(),
});
export type MetaPageRaw = z.infer<typeof metaPageSchema>;

export const metaBusinessSchema = z.object({ id: z.string(), name: z.string().optional() });

/** Graph API sayfalı liste: `{ data: [...], paging: { next? } }`. */
export function pagedListSchema<T extends z.ZodTypeAny>(item: T) {
  return z.object({ data: z.array(item), paging: z.object({ next: z.string().optional() }).optional() });
}

/** `paging.next` erişim token'ını taşır — yalnızca Graph API adresine gidilir. */
export function isGraphUrl(url: string): boolean {
  return url.startsWith("https://graph.facebook.com/");
}

/** Aynı Sayfa birden fazla yoldan (kendi hesabı + işletme) gelebilir; ilk görülen tutulur. */
export function dedupePages(pages: readonly MetaPageRaw[]): MetaPageRaw[] {
  const seen = new Set<string>();
  return pages.filter((page) => {
    if (seen.has(page.id)) return false;
    seen.add(page.id);
    return true;
  });
}

export function instagramAccountsOf(pages: readonly MetaPageRaw[]): { id: string; username: string | null }[] {
  return pages.flatMap((page) =>
    page.instagram_business_account ? [{ id: page.instagram_business_account.id, username: page.instagram_business_account.username ?? null }] : [],
  );
}

const oneLine = (text: string) => text.replace(/\s+/g, " ").trim();

/** Log için tek satır: `id:ad:ig=var/yok` — token veya başka değer içermez. */
export function summarizePages(pages: readonly MetaPageRaw[]): string {
  if (pages.length === 0) return "-";
  return pages.map((page) => `${page.id}:${oneLine(page.name ?? "-")}:ig=${page.instagram_business_account ? "var" : "yok"}`).join(", ");
}
