import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler:true,
  output:"standalone",
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

export default nextConfig;
