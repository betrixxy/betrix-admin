import { env } from "@/lib/env";

/** Yerel geliştirmede tarayıcıdan test edebilmek için localhost otomatik izinlenir. */
export function allowedTrackOrigins(): string[] {
  const configured = env.TRACK_ALLOWED_ORIGINS.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  return env.NODE_ENV === "production" ? configured : [...configured, "http://localhost:3000"];
}

export function isOriginAllowed(origin: string | null): origin is string {
  return origin !== null && allowedTrackOrigins().includes(origin);
}

export function trackCorsHeaders(origin: string): HeadersInit {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Track-Key",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}
