import type { ReactNode } from "react";
import { Sidebar } from "@/components/features/dashboard/sidebar";

/**
 * Tüm dashboard modüllerinin ortak kabuğu: sol menü + içerik alanı. Yeni bir modül
 * `app/dashboard/<modül>/page.tsx` olarak eklendiğinde bu düzeni otomatik devralır.
 */
export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen bg-background lg:pl-60">
      <div
        aria-hidden
        className="pointer-events-none fixed -top-32 left-1/2 h-72 w-[50rem] -translate-x-1/2 rounded-full bg-emerald-500/[0.06] blur-[140px]"
      />
      <Sidebar />
      <main className="relative mx-auto flex max-w-[1500px] flex-col gap-6 px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
        {children}
      </main>
    </div>
  );
}
