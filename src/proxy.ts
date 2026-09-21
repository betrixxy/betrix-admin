import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth/session";

const PROTECTED_PATH_PREFIXES = ["/calendar", "/studio"];

function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/** Oturum açmamış kullanıcıları /calendar ve /studio'dan /login'e yönlendirir (bkz. CLAUDE.md FAZ 6). */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;

  if (isProtectedPath(pathname)) {
    if (session) return NextResponse.next();

    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (pathname === "/login" && session) {
    return NextResponse.redirect(new URL("/calendar", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/calendar/:path*", "/studio/:path*", "/login"],
};
