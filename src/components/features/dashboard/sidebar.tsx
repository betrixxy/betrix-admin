import { LogOut } from "lucide-react";
import { logoutAction } from "@/app/login/actions";
import { Button } from "@/components/ui/button";
import { SidebarNav, TopBarNav } from "./sidebar-nav";

function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex size-8 items-center justify-center rounded-md bg-emerald-500/15 text-xs font-bold text-emerald-400 ring-1 ring-emerald-500/30">
        CM
      </div>
      <div className="flex flex-col leading-none">
        <span className="text-sm font-semibold text-white">CheckMatch.net</span>
        <span className="text-[10px] text-muted-foreground">betrix.pro Studio</span>
      </div>
    </div>
  );
}

function LogoutButton() {
  return (
    <form action={logoutAction}>
      <Button type="submit" variant="ghost" size="sm" className="w-full justify-start">
        <LogOut />
        Çıkış yap
      </Button>
    </form>
  );
}

/** Masaüstünde sabit sol menü; dar ekranlarda marka + yatay modül menüsü olan üst çubuk. */
export function Sidebar() {
  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-60 flex-col gap-8 border-r border-border bg-background/95 p-4 backdrop-blur-md lg:flex">
        <Brand />
        <div className="flex-1 overflow-y-auto">
          <SidebarNav />
        </div>
        <LogoutButton />
      </aside>

      <header className="sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur-md lg:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <Brand />
          <LogoutButton />
        </div>
        <TopBarNav />
      </header>
    </>
  );
}
