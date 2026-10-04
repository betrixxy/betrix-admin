import Image from "next/image";
import { cn } from "@/lib/utils";

/** `public/brand/` altındaki kırpılmış marka logosu (kaynak: masaüstü Logo/logo2.png). */
export const BRAND_LOGO = {
  src: "/brand/checkmatch-logo-net.png",
  width: 1588,
  height: 258,
  alt: "CheckMatch.net",
} as const;

interface BrandLogoProps {
  className?: string;
  priority?: boolean;
}

/** CheckMatch.net yatay logosu; yükseklik `className` ile verilir (ör. `h-6`), genişlik orantılı. */
export function BrandLogo({ className, priority = false }: BrandLogoProps) {
  return (
    <Image
      src={BRAND_LOGO.src}
      // Görüntülenen en büyük yükseklik (~48px) kadar içsel boyut: next/image küçük srcset üretir.
      width={Math.round((BRAND_LOGO.width * 48) / BRAND_LOGO.height)}
      height={48}
      alt={BRAND_LOGO.alt}
      priority={priority}
      className={cn("h-6 w-auto select-none", className)}
    />
  );
}

/** Panel üst çubuğu / sol menüsündeki marka bloğu: logo + "betrix.pro Studio" alt başlığı. */
export function StudioBrand() {
  return (
    <div className="flex flex-col gap-1 leading-none">
      <BrandLogo className="h-5" priority />
      <span className="pl-[13%] text-[10px] text-muted-foreground">betrix.pro Studio</span>
    </div>
  );
}
