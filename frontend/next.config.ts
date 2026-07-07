import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
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
