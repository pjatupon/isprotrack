import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typedRoutes: false,
  experimental: {
    serverActions: {
      bodySizeLimit: "16mb",
    },
  },
};

export default nextConfig;
