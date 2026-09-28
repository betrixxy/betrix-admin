import { revalidatePath } from "next/cache";

export const UNAUTHORIZED_MESSAGE = "Oturum bulunamadı — lütfen tekrar giriş yapın.";

/** Dashboard altındaki tüm sayfalar (özet + 4 modül) mutasyon sonrası yeniden okunur. */
export function refreshDashboard(): void {
  revalidatePath("/dashboard", "layout");
}
