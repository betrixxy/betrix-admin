import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Docker üretim imajı için: yalnızca çalışma zamanında gereken dosyaları `.next/standalone`
  // altına izleyip kopyalar (node_modules'ün tamamı imaja girmez) — bkz. Dockerfile.
  output: "standalone",
  experimental: {
    // Stüdyo formları görseli Server Action ile yükler (Maç Günü: iki oyuncu × en fazla 8 MB,
    // bkz. lib/dashboard/image-limits.ts). Varsayılanlar (1 MB / proxy 10 MB) bunu keser.
    serverActions: { bodySizeLimit: "20mb" },
    proxyClientMaxBodySize: "20mb",
  },
  // `/api/files/<kova>/<dosya>` (veritabanında saklanan genel adres) → segmentsiz route.
  // Neden dinamik route kullanılmadığı: bkz. src/app/api/storage-file/route.ts.
  async rewrites() {
    return [{ source: "/api/files/:bucket/:file", destination: "/api/storage-file?bucket=:bucket&file=:file" }];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "media.api-sports.io",
        pathname: "/football/teams/**",
      },
    ],
  },
};

export default nextConfig;
