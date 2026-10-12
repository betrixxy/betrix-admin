import { z } from "zod";
import { fetchJson } from "@/lib/services/shared/http";
import type { SocialApiError } from "@/lib/services/social/client";
import { META_GRAPH_VERSION } from "@/lib/services/social/oauth-providers";
import type { Result } from "@/types/result";

/**
 * Instagram Graph API ile paylaşım (Instagram iş/içerik üreticisi hesabı, `instagram_content_publish`).
 * Akış: medya container'ı oluştur → işlenmesini bekle (`status_code = FINISHED`) → `media_publish`.
 * Meta görseli `image_url`'den kendisi indirir: adres herkese açık ve JPEG olmalıdır (bkz.
 * app/api/public-media — imzalı, kısa ömürlü). Oluşturma/yayın istekleri yeniden denenmez (çift paylaşım riski).
 */

const GRAPH = `https://graph.facebook.com/${META_GRAPH_VERSION}`;
/** Carousel: 2-10 öğe. */
export const INSTAGRAM_MAX_CAROUSEL = 10;
const POLL_INTERVAL_MS = 2_000;
const POLL_ATTEMPTS = 20;

const idSchema = z.object({ id: z.string() });
const statusSchema = z.object({ status_code: z.string().optional() });
const permalinkSchema = z.object({ permalink: z.string().optional() });

export type InstagramKind = "feed" | "story";

export interface InstagramPublishRequest {
  accessToken: string;
  /** Instagram iş hesabı kimliği (SocialConnection.accountId). */
  igUserId: string;
  /** Hikâye bağlantısı için profil adı. */
  username: string | null;
  caption: string;
  /** Herkese açık JPEG adresleri, yayın sırasıyla. */
  imageUrls: string[];
  kind: InstagramKind;
}

type PublishResult = Result<{ postId: string; url: string }, SocialApiError>;

const fail = (message: string): { ok: false; error: SocialApiError } => ({ ok: false, error: { code: "HTTP", message } });

async function graphPost(path: string, params: Record<string, string>, accessToken: string): Promise<Result<string, SocialApiError>> {
  const body = new URLSearchParams({ ...params, access_token: accessToken });
  const response = await fetchJson(`${GRAPH}/${path}`, { method: "POST", body, headers: { Accept: "application/json" } }, { retries: 0, timeoutMs: 30_000 });
  if (!response.ok) return fail(`Instagram ${path.split("/").at(-1) ?? path}: ${response.error.message}`);
  const parsed = idSchema.safeParse(response.data);
  return parsed.success ? { ok: true, data: parsed.data.id } : fail("Instagram yanıtında medya kimliği yok.");
}

async function graphGet<T extends z.ZodTypeAny>(path: string, fields: string, accessToken: string, schema: T): Promise<z.infer<T> | null> {
  const url = new URL(`${GRAPH}/${path}`);
  url.search = new URLSearchParams({ fields, access_token: accessToken }).toString();
  const response = await fetchJson(url.toString(), { headers: { Accept: "application/json" } });
  if (!response.ok) return null;
  const parsed = schema.safeParse(response.data);
  return parsed.success ? parsed.data : null;
}

/** Container hazır olana kadar bekler (Meta görseli indirip işler). */
async function waitUntilReady(containerId: string, accessToken: string): Promise<Result<null, SocialApiError>> {
  for (let attempt = 0; attempt < POLL_ATTEMPTS; attempt += 1) {
    const status = (await graphGet(containerId, "status_code", accessToken, statusSchema))?.status_code;
    if (status === "FINISHED" || status === "PUBLISHED") return { ok: true, data: null };
    if (status === "ERROR" || status === "EXPIRED") return fail(`Instagram görseli işleyemedi (${status}) — görsel adresi erişilebilir ve JPEG olmalı.`);
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
  return fail("Instagram görseli zamanında işlemedi — birazdan tekrar deneyin.");
}

async function createReady(igUserId: string, params: Record<string, string>, accessToken: string): Promise<Result<string, SocialApiError>> {
  const container = await graphPost(`${igUserId}/media`, params, accessToken);
  if (!container.ok) return container;
  const ready = await waitUntilReady(container.data, accessToken);
  return ready.ok ? container : ready;
}

function publishContainer(igUserId: string, containerId: string, accessToken: string): Promise<Result<string, SocialApiError>> {
  return graphPost(`${igUserId}/media_publish`, { creation_id: containerId }, accessToken);
}

/** Hikâye: her görsel ayrı kare (hikâyede metin alanı yoktur). */
async function publishStories(request: InstagramPublishRequest): Promise<PublishResult> {
  let firstId: string | null = null;
  for (const imageUrl of request.imageUrls) {
    const container = await createReady(request.igUserId, { image_url: imageUrl, media_type: "STORIES" }, request.accessToken);
    if (!container.ok) return container;
    const published = await publishContainer(request.igUserId, container.data, request.accessToken);
    if (!published.ok) return published;
    firstId ??= published.data;
  }
  const url = request.username ? `https://www.instagram.com/stories/${request.username}/` : "https://www.instagram.com/";
  return { ok: true, data: { postId: firstId ?? "", url } };
}

/** Akış gönderisi (tek görsel ya da 2-10 görsellik carousel) veya hikâye; başarılıysa medya kimliği ve bağlantısı. */
export async function publishInstagram(request: InstagramPublishRequest): Promise<PublishResult> {
  const { accessToken, igUserId, imageUrls, caption } = request;
  const [first] = imageUrls;
  if (first === undefined) return fail("Paylaşılacak görsel yok.");
  if (request.kind === "story") return publishStories(request);
  if (imageUrls.length > INSTAGRAM_MAX_CAROUSEL) return fail(`Instagram carousel en fazla ${INSTAGRAM_MAX_CAROUSEL} görsel alır.`);

  let containerId: string;
  if (imageUrls.length === 1) {
    const single = await createReady(igUserId, { image_url: first, caption }, accessToken);
    if (!single.ok) return single;
    containerId = single.data;
  } else {
    const children: string[] = [];
    for (const imageUrl of imageUrls) {
      const child = await createReady(igUserId, { image_url: imageUrl, is_carousel_item: "true" }, accessToken);
      if (!child.ok) return child;
      children.push(child.data);
    }
    const carousel = await createReady(igUserId, { media_type: "CAROUSEL", children: children.join(","), caption }, accessToken);
    if (!carousel.ok) return carousel;
    containerId = carousel.data;
  }
  const published = await publishContainer(igUserId, containerId, accessToken);
  if (!published.ok) return published;
  const permalink = (await graphGet(published.data, "permalink", accessToken, permalinkSchema))?.permalink;
  return { ok: true, data: { postId: published.data, url: permalink ?? "https://www.instagram.com/" } };
}
