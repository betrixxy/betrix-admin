import {
  BarChart3,
  CalendarDays,
  Globe,
  Images,
  LayoutDashboard,
  Layers,
  Sparkles,
  Swords,
  Trophy,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
}

/**
 * Sol menünün ana modülleri. Yeni bir modül eklemek için `app/dashboard/<modül>/`
 * klasörünü açıp buraya tek bir satır eklemek yeterlidir; menü ve aktiflik vurgusu
 * bu listeden türetilir.
 */
export const DASHBOARD_NAV: readonly NavItem[] = [
  {
    href: "/dashboard",
    label: "Genel Bakış",
    description: "4 modülün özeti",
    icon: LayoutDashboard,
  },
  {
    href: "/dashboard/matches",
    label: "Maç Merkezi",
    description: "İçerik türü seç → stüdyo + onay",
    icon: Trophy,
  },
  {
    href: "/dashboard/calendar",
    label: "İçerik Takvimi",
    description: "Gönderi planlama",
    icon: CalendarDays,
  },
  {
    href: "/dashboard/analytics",
    label: "Etkileşim & Reklam",
    description: "Gönderi performansı",
    icon: BarChart3,
  },
  {
    href: "/dashboard/studio",
    label: "AI İçerik Stüdyosu",
    description: "Görsel üretimi",
    icon: Sparkles,
  },
  {
    href: "/dashboard/studio/match-day",
    label: "Maç Günü Kartı",
    description: "Maç seç + oyuncu yükle → AI poster",
    icon: Swords,
  },
  {
    href: "/dashboard/library",
    label: "Medya Kütüphanesi",
    description: "Logo, oyuncu, referans",
    icon: Images,
  },
  {
    href: "/dashboard/traffic",
    label: "Web Trafiği",
    description: "checkmatch.net ziyaretçileri",
    icon: Globe,
  },
];

/** FAZ 2-4'te kurulan, dashboard dışındaki mevcut araçlar — menüde ikincil grupta durur. */
export const LEGACY_NAV: readonly NavItem[] = [
  {
    href: "/calendar",
    label: "Fikstür CRM",
    description: "Maç bazlı içerik planı",
    icon: CalendarDays,
  },
  {
    href: "/studio",
    label: "Render Stüdyosu",
    description: "Maç kartı şablonları",
    icon: Layers,
  },
];

/** `/dashboard` yalnızca tam eşleşmede aktiftir; diğerleri alt yollarda da aktif kalır. */
export function isNavItemActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") return pathname === href;
  const matches = (candidate: string) => pathname === candidate || pathname.startsWith(`${candidate}/`);
  if (!matches(href)) return false;
  // Alt rotası ayrı bir menü öğesi olan modül (ör. studio → studio/match-day) orada aktif sayılmaz.
  return ![...DASHBOARD_NAV, ...LEGACY_NAV].some(
    (item) => item.href.length > href.length && item.href.startsWith(`${href}/`) && matches(item.href),
  );
}
