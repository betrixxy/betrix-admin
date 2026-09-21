import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/auth/password";

export interface AuthenticatedAdmin {
  id: string;
  email: string;
}

/**
 * Kullanıcı bulunamadığında da bcrypt karşılaştırması sabit bir hash ile yapılır —
 * yalnızca gerçek kullanıcılarda hash karşılaştırması çalıştırmak, "hesap var mı"
 * bilgisini yanıt süresinden sızdırabilir (timing attack).
 */
const TIMING_SAFE_DUMMY_HASH = "$2b$12$eez6PfXNFJgyyDmd7/KDkOzHilSBdZfPtXqsdTx0Q2Urv11vLl5rK";

/** Tek admin hesabına karşı e-posta/şifre doğrular — bkz. CLAUDE.md FAZ 6. */
export async function verifyAdminCredentials(
  email: string,
  password: string,
): Promise<AuthenticatedAdmin | null> {
  const admin = await prisma.adminUser.findUnique({
    where: { email: email.toLowerCase().trim() },
  });

  if (!admin) {
    await verifyPassword(password, TIMING_SAFE_DUMMY_HASH);
    return null;
  }

  const isValid = await verifyPassword(password, admin.passwordHash);
  if (!isValid) return null;

  return { id: admin.id, email: admin.email };
}
