import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import type { ConnectErrorCode, PlatformSlug } from "@/types/social-connection";

const ANALYTICS_PATH = "/dashboard/analytics";

/**
 * OAuth route handler'larının panele dönüşü. Yalnızca sabit bir hata kodu kümesi URL'e
 * yazılır — sağlayıcıdan gelen serbest metin arayüze yansıtılmaz. Mutlak adres
 * `APP_BASE_URL`'den kurulur (Caddy arkasında `request.url` iç adresi gösterir).
 */
export function redirectToAnalytics(
  slug: PlatformSlug,
  outcome: { connected: true } | { error: ConnectErrorCode },
): NextResponse {
  const url = new URL(ANALYTICS_PATH, env.APP_BASE_URL);
  if ("error" in outcome) {
    url.searchParams.set("connect_error", outcome.error);
    url.searchParams.set("platform", slug);
  } else {
    url.searchParams.set("connected", slug);
  }
  return NextResponse.redirect(url);
}

export function redirectToLogin(): NextResponse {
  const url = new URL("/login", env.APP_BASE_URL);
  url.searchParams.set("from", ANALYTICS_PATH);
  return NextResponse.redirect(url);
}
