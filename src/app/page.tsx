import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth/session";

/** Kök adres her zaman yönlendirir — oturum varsa /dashboard'a, yoksa /login'e (bkz. CLAUDE.md 1.6). */
export default async function HomePage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;

  redirect(session ? "/dashboard" : "/login");
}
