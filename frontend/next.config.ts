import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
  // CMS pages and metadata must always come from the server after an admin edit.
  cacheStartUrl: false,
  cacheOnFrontEndNav: false,
  aggressiveFrontEndNavCaching: false,
  reloadOnOnline: true,
  extendDefaultRuntimeCaching: true,
  runtimeCaching: [
    {
      urlPattern: ({ request, sameOrigin }) =>
        sameOrigin &&
        (request.mode === "navigate" || request.headers.get("RSC") === "1"),
      handler: "NetworkOnly",
      options: { cacheName: "cms-live-pages" },
    },
  ],
  workboxOptions: {
    disableDevLogs: true,
    cleanupOutdatedCaches: true,
  },
});

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler:true,
  output:"standalone",
  turbopack: {},
  typescript:{
    ignoreBuildErrors:true
  },
   experimental: {
    serverActions: {
      bodySizeLimit: "40mb",
    },
  },
  images: {
    unoptimized: true,
  },
  async headers() {
    const noCacheHeaders = [
      { key: "Cache-Control", value: "no-store, no-cache, must-revalidate, max-age=0, s-maxage=0" },
      { key: "CDN-Cache-Control", value: "no-store" },
      { key: "Vercel-CDN-Cache-Control", value: "no-store" },
    ];
    return [
      { source: "/", headers: noCacheHeaders },
      { source: "/(login|register)", headers: noCacheHeaders },
      { source: "/home/:path*", headers: noCacheHeaders },
      { source: "/collection/:path*", headers: noCacheHeaders },
    ];
  },
  
};

export default withPWA(nextConfig);
