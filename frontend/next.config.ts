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
  workboxOptions: {
    disableDevLogs: true,
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
  
};

export default withPWA(nextConfig);
