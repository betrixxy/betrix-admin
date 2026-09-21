import { SignJWT, jwtVerify } from "jose";
import { env } from "@/lib/env";

export const SESSION_COOKIE_NAME = "checkmatch_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 gün

export interface SessionPayload {
  adminId: string;
  email: string;
}

const textEncoder = new TextEncoder();

function getSecretKey(): Uint8Array {
  if (!env.JWT_SECRET) {
    throw new Error("JWT_SECRET tanımlı değil — .env.local dosyasını doldurun.");
  }
  return textEncoder.encode(env.JWT_SECRET);
}

/** Oturum JWT'si üretir — `jose` kullanılır çünkü middleware Edge runtime'da çalışır (bkz. src/middleware.ts). */
export function createSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ adminId: payload.adminId, email: payload.email })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(getSecretKey());
}

/** Geçersiz/süresi dolmuş/imzası uyuşmayan token'larda sessizce `null` döner — çağıran kod bunu "oturum yok" sayar. */
export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    if (typeof payload.adminId !== "string" || typeof payload.email !== "string") {
      return null;
    }
    return { adminId: payload.adminId, email: payload.email };
  } catch {
    return null;
  }
}
