import { Prisma } from "@/generated/prisma/client";
import { generateShortCode, shortLinkUrl } from "@/lib/dashboard/short-link-code";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import type { SocialPlatformType } from "@/types/social";

/**
 * Kısa link kaydının tek erişim noktası (bkz. CLAUDE.md 4.3). Yayın Merkezi taslak için kod üretir (metne
 * eklenebilsin diye paylaşımdan ÖNCE); paylaşımda kod gönderiye bağlanır. Her gönderi/taslak için tek kod.
 */

export interface ShortLinkView {
  code: string;
  url: string;
}

const view = (code: string): ShortLinkView => ({ code, url: shortLinkUrl(env.SHORT_LINK_BASE_URL, code) });

const MAX_CODE_ATTEMPTS = 5;

async function createWithUniqueCode(data: Omit<Prisma.ShortLinkUncheckedCreateInput, "code">): Promise<string> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return (await prisma.shortLink.create({ data: { ...data, code: generateShortCode() }, select: { code: true } })).code;
    } catch (error) {
      const codeClash = error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002" && JSON.stringify(error.meta ?? {}).includes("code");
      if (!codeClash || attempt >= MAX_CODE_ATTEMPTS) throw error;
    }
  }
}

/** Taslağın kısa linki (yoksa açılır) — Yayın Merkezi X ve Instagram story metni için. */
export async function ensureDraftShortLink(aiContentId: string, platform: SocialPlatformType): Promise<ShortLinkView> {
  const existing = await prisma.shortLink.findUnique({ where: { aiContentId }, select: { code: true, platform: true } });
  if (existing) {
    if (existing.platform !== platform) await prisma.shortLink.update({ where: { aiContentId }, data: { platform } });
    return view(existing.code);
  }
  const content = await prisma.aiContent.findUnique({ where: { id: aiContentId }, select: { contentType: true, postId: true } });
  try {
    return view(await createWithUniqueCode({ aiContentId, platform, contentType: content?.contentType ?? null }));
  } catch (error) {
    // Eşzamanlı iki istek: diğeri az önce açtı.
    const again = await prisma.shortLink.findUnique({ where: { aiContentId }, select: { code: true } });
    if (again) return view(again.code);
    throw error;
  }
}

/** Gönderinin kısa linki (yoksa açılır) — gönderi detayında ve içe aktarılan gönderilerde. */
export async function ensurePostShortLink(socialPostId: string): Promise<ShortLinkView | null> {
  const existing = await prisma.shortLink.findUnique({ where: { socialPostId }, select: { code: true } });
  if (existing) return view(existing.code);
  const post = await prisma.socialPost.findUnique({
    where: { id: socialPostId },
    select: { platform: { select: { type: true } }, aiContents: { select: { contentType: true }, take: 1, orderBy: { updatedAt: "desc" } } },
  });
  if (!post) return null;
  try {
    return view(await createWithUniqueCode({ socialPostId, platform: post.platform.type, contentType: post.aiContents[0]?.contentType ?? null }));
  } catch (error) {
    const again = await prisma.shortLink.findUnique({ where: { socialPostId }, select: { code: true } });
    if (again) return view(again.code);
    throw error;
  }
}

/** Paylaşım anında: taslağın kısa linki gönderiye bağlanır (yönlendirme artık utm_content=<socialPostId> taşır). */
export async function attachDraftShortLink(tx: Prisma.TransactionClient, aiContentId: string, socialPostId: string, platform: SocialPlatformType): Promise<void> {
  const link = await tx.shortLink.findUnique({ where: { aiContentId }, select: { id: true } });
  if (!link) return;
  const taken = await tx.shortLink.findUnique({ where: { socialPostId }, select: { id: true } });
  if (taken && taken.id !== link.id) return;
  await tx.shortLink.update({ where: { id: link.id }, data: { socialPostId, platform } });
}

export function shortLinkView(code: string): ShortLinkView {
  return view(code);
}
