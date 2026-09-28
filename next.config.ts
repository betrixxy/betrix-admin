import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Docker üretim imajı için: yalnızca çalışma zamanında gereken dosyaları `.next/standalone`
  // altına izleyip kopyalar (node_modules'ün tamamı imaja girmez) — bkz. Dockerfile.
  output: "standalone",
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
