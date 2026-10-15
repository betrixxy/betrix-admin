import { socialUseMocks } from "@/lib/env";
import { getJson, type SocialApiError } from "@/lib/services/social/client";
import { IG_MEDIA_FIELDS, igMediaListSchema, type IgMediaListRaw, type IgMediaRaw } from "@/lib/services/social/instagram-raw";
import { isGraphUrl } from "@/lib/services/social/meta-pages";
import { mockIgMediaPage } from "@/lib/services/social/mock-import";
import { META_GRAPH_VERSION } from "@/lib/services/social/oauth-providers";
import type { Result } from "@/types/result";

/**
 * Instagram Graph API okuma çağrıları (yalnızca GET — bkz. CLAUDE.md 1.10): gönderi listesi.
 * Meta çağrı başına ücret almaz; hız limiti kullanıcı başına saatlik kotadır.
 */

const GRAPH = `https://graph.facebook.com/${META_GRAPH_VERSION}`;
const PAGE_SIZE = 50;
/** Sayfalama döngüsü için güvenlik sınırı. */
const MAX_PAGES = 40;

/** Hesabın gönderileri, yeniden eskiye, en fazla `limit` adet. Story'ler bu listede yer almaz (Meta kısıtı). */
export async function listInstagramMedia(accessToken: string, igUserId: string, limit: number): Promise<Result<IgMediaRaw[], SocialApiError>> {
  if (socialUseMocks) {
    const parsed = igMediaListSchema.safeParse(mockIgMediaPage(limit));
    return parsed.success ? { ok: true, data: parsed.data.data } : { ok: false, error: { code: "INVALID_RESPONSE", message: "Mock Instagram yanıtı şemaya uymuyor." } };
  }

  const items: IgMediaRaw[] = [];
  const first = new URL(`${GRAPH}/${encodeURIComponent(igUserId)}/media`);
  first.search = new URLSearchParams({ fields: IG_MEDIA_FIELDS, limit: String(Math.min(PAGE_SIZE, limit)), access_token: accessToken }).toString();
  let next: string | undefined = first.toString();

  for (let page = 0; next && items.length < limit && page < MAX_PAGES; page += 1) {
    if (!isGraphUrl(next)) break;
    const result: Result<IgMediaListRaw, SocialApiError> = await getJson(next, {}, igMediaListSchema, "Instagram gönderi listesi");
    if (!result.ok) return result;
    items.push(...result.data.data);
    next = result.data.paging?.next;
  }
  return { ok: true, data: items.slice(0, limit) };
}
