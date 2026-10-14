import { z } from "zod";
import { getJson, type SocialApiError } from "@/lib/services/social/client";
import {
  META_PAGE_FIELDS,
  dedupePages,
  instagramAccountsOf,
  isGraphUrl,
  metaBusinessSchema,
  metaPageSchema,
  pagedListSchema,
  summarizePages,
  type MetaPageRaw,
} from "@/lib/services/social/meta-pages";
import { META_GRAPH_VERSION } from "@/lib/services/social/oauth-providers";
import type { Result } from "@/types/result";
import type { OAuthAccount } from "@/types/social-connection";

/**
 * Instagram hesabı bulma (Facebook Login): Sayfaya bağlı Instagram iş/içerik üreticisi hesabı.
 * Önce kullanıcının kendi Sayfaları (`/me/accounts`, sayfalı); IG yoksa Business Manager üzerinden
 * (`/me/businesses` → `owned_pages` + `client_pages`). Loglar yalnızca kimlik/ad/var-yok içerir — token asla.
 */

const GRAPH = `https://graph.facebook.com/${META_GRAPH_VERSION}`;
const MAX_PAGES = 10;
const LOG = "[oauth:instagram]";

function graphUrl(path: string, params: Record<string, string>, accessToken: string): string {
  const url = new URL(`${GRAPH}${path}`);
  url.search = new URLSearchParams({ ...params, access_token: accessToken }).toString();
  return url.toString();
}

/** `paging.next` takibiyle en fazla 10 sayfa okur. */
async function fetchAll<T extends z.ZodTypeAny>(firstUrl: string, item: T, what: string): Promise<Result<z.infer<T>[], SocialApiError>> {
  const schema = pagedListSchema(item);
  const items: z.infer<T>[] = [];
  let next: string | undefined = firstUrl;
  for (let page = 0; next && page < MAX_PAGES; page += 1) {
    const result: Result<z.infer<typeof schema>, SocialApiError> = await getJson(next, {}, schema, what);
    if (!result.ok) return result;
    items.push(...result.data.data);
    next = result.data.paging?.next;
    if (next && !isGraphUrl(next)) next = undefined;
  }
  return { ok: true, data: items };
}

const pageListUrl = (path: string, accessToken: string) => graphUrl(path, { fields: META_PAGE_FIELDS, limit: "100" }, accessToken);

/** Yedek yol: kullanıcının işletmelerinin sahip olduğu ve yönettiği (müşteri) Sayfalar. */
async function fetchBusinessPages(accessToken: string): Promise<Result<MetaPageRaw[], SocialApiError>> {
  const businesses = await fetchAll(graphUrl("/me/businesses", { fields: "id,name", limit: "100" }, accessToken), metaBusinessSchema, "Meta işletmeleri");
  if (!businesses.ok) return businesses;

  const pages: MetaPageRaw[] = [];
  for (const business of businesses.data) {
    for (const edge of ["owned_pages", "client_pages"] as const) {
      const result = await fetchAll(pageListUrl(`/${business.id}/${edge}`, accessToken), metaPageSchema, `İşletme ${edge}`);
      // Bir kenarın hatası (ör. o işletmede yetki yok) diğerlerini engellemez.
      if (result.ok) pages.push(...result.data);
      else console.warn(`${LOG} işletme ${business.id} ${edge} okunamadı: ${result.error.message}`);
    }
  }
  return { ok: true, data: pages };
}

const metaPermissionsSchema = z.object({ data: z.array(z.object({ permission: z.string(), status: z.string() })) });

export interface MetaPermissions {
  granted: string[];
  declined: string[];
}

/** Token'a gerçekte verilen / reddedilen izinler (`/me/permissions`). */
export async function fetchMetaPermissions(accessToken: string): Promise<Result<MetaPermissions, SocialApiError>> {
  const result = await getJson(graphUrl("/me/permissions", {}, accessToken), {}, metaPermissionsSchema, "Meta izinleri");
  if (!result.ok) return result;
  const byStatus = (status: string) => result.data.data.filter((row) => row.status === status).map((row) => row.permission);
  return { ok: true, data: { granted: byStatus("granted"), declined: byStatus("declined") } };
}

function describeGrant(permissions: Result<MetaPermissions, SocialApiError>): string {
  if (!permissions.ok) return "izinler okunamadı";
  const list = (names: string[]) => names.join(",") || "-";
  return `verilen=[${list(permissions.data.granted)}], reddedilen=[${list(permissions.data.declined)}]`;
}

/** `permissions`: hesap aşamasında zaten okunmuşsa tekrar istenmez (hata mesajındaki tanı için). */
export async function findInstagramAccount(
  accessToken: string,
  permissions: Result<MetaPermissions, SocialApiError> | null,
): Promise<Result<OAuthAccount, SocialApiError>> {
  const own = await fetchAll(pageListUrl("/me/accounts", accessToken), metaPageSchema, "Instagram hesap bilgisi");
  if (!own.ok) return own;

  let pages = own.data;
  let businessNote = "";
  if (instagramAccountsOf(pages).length === 0) {
    const viaBusiness = await fetchBusinessPages(accessToken);
    if (viaBusiness.ok) pages = dedupePages([...pages, ...viaBusiness.data]);
    else {
      console.warn(`${LOG} işletme yolu okunamadı: ${viaBusiness.error.message}`);
      businessNote = ", işletme yolu okunamadı";
    }
  }
  console.info(`${LOG} sayfalar (${pages.length}): ${summarizePages(pages)}`);

  const accounts = instagramAccountsOf(pages);
  const [first] = accounts;
  if (!first) {
    const grant = describeGrant(permissions ?? (await fetchMetaPermissions(accessToken)));
    return {
      ok: false,
      error: {
        code: "INVALID_RESPONSE",
        message: `Bu Facebook hesabına bağlı bir Instagram iş/içerik üreticisi hesabı bulunamadı (sayfa=${pages.length}${businessNote}, ${grant}).`,
      },
    };
  }
  if (accounts.length > 1) {
    // Şimdilik ilki seçilir; hesap seçimi arayüzü gelene kadar hepsi loglanır.
    console.info(`${LOG} ${accounts.length} IG hesabı bulundu, ilki seçildi: ${accounts.map((account) => `${account.id}(${account.username ?? "-"})`).join(", ")}`);
  }
  return { ok: true, data: { accountId: first.id, accountName: first.username } };
}
