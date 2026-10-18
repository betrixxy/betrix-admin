import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Docker üretim imajı için: yalnızca çalışma zamanında gereken dosyaları `.next/standalone`
  // altına izleyip kopyalar (node_modules'ün tamamı imaja girmez) — bkz. Dockerfile.
  output: "standalone",
  // Maç Sonucu yerel yüz tespiti (lib/dashboard/match-photo/faces.ts): onnxruntime-web WASM'ı
  // çalışma anında dosyadan yükler — paketlenmez, WASM ve YuNet modeli standalone çıktıya izlenir.
  serverExternalPackages: ["onnxruntime-web"],
  outputFileTracingIncludes: {
    "/dashboard/studio/match-result": ["./assets/models/**", "./node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded*"],
  },
  experimental: {
    // Stüdyo formları görseli Server Action ile yükler (Maç Günü: iki oyuncu × en fazla 8 MB,
    // bkz. lib/dashboard/image-limits.ts). Varsayılanlar (1 MB / proxy 10 MB) bunu keser.
    serverActions: { bodySizeLimit: "20mb" },
    proxyClientMaxBodySize: "20mb",
  },
  // `/api/files/<kova>/<dosya>` (veritabanında saklanan genel adres) → segmentsiz route.
  // Neden dinamik route kullanılmadığı: bkz. src/app/api/storage-file/route.ts.
  // Eski "İçerik Takvimi" (SocialPost planlama) ve "Fikstür CRM" (ay ızgarası) sayfaları
  // İçerik Planı'nda birleşti — eski yer imleri ve bağlantılar oraya kalıcı yönlenir. Veriler silinmedi.
  async redirects() {
    return [
      { source: "/calendar", destination: "/dashboard/plan", permanent: true },
      { source: "/calendar/:path*", destination: "/dashboard/plan", permanent: true },
      { source: "/dashboard/calendar", destination: "/dashboard/plan", permanent: true },
      { source: "/dashboard/calendar/:path*", destination: "/dashboard/plan", permanent: true },
    ];
  },
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
