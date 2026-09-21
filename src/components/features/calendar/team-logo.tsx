import Image from "next/image";
import { cn } from "@/lib/utils";

interface TeamLogoProps {
  logoUrl: string;
  teamName: string;
  size?: number;
  className?: string;
}

/** Takım arması — API-Football logoları şeffaf/koyu olabildiği için hafif beyaz bir zemin üzerinde gösterilir. */
export function TeamLogo({ logoUrl, teamName, size = 16, className }: TeamLogoProps) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-white ring-1 ring-black/5",
        className,
      )}
      style={{ width: size, height: size }}
    >
      <Image
        src={logoUrl}
        alt={teamName}
        width={size}
        height={size}
        className="size-full object-contain p-[1.5px]"
      />
    </span>
  );
}
