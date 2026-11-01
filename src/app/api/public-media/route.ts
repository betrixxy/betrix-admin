import { createPublicMediaHandler } from "@/lib/dashboard/public-media-handler";
import { verifyPublicMedia } from "@/lib/dashboard/public-media";
import { readStoredFile } from "@/lib/dashboard/storage";
import { isUnapprovedVitrinFile } from "@/lib/prediction/vitrin-files";

// İmzası ve süresi her istekte denetlenir — statik önbelleğe alınmaz (bkz. CLAUDE.md 1.5).
export const dynamic = "force-dynamic";

/**
 * İmzalı, kısa ömürlü genel medya (bkz. lib/dashboard/public-media.ts) — Instagram Graph API'nin paylaşım
 * sırasında görseli indirdiği adres. Mantık: `lib/dashboard/public-media-handler.ts`. Rota bilerek dinamik
 * segmentsizdir (bkz. app/api/storage-file).
 */
export const GET = createPublicMediaHandler({
  verify: (target, expires, sig) => verifyPublicMedia(target, expires, sig),
  isUnapprovedVitrin: isUnapprovedVitrinFile,
  readFile: readStoredFile,
});
