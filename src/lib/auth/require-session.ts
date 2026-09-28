import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME, verifySessionToken, type SessionPayload } from "@/lib/auth/session";

/**
 * Server Action'lar için savunma katmanı: `proxy.ts` sayfa isteklerini korur, ancak
 * veritabanına yazan her aksiyon oturumu kendisi de doğrular. Oturum yoksa `null` döner.
 */
export async function getCurrentSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  return token ? verifySessionToken(token) : null;
}
