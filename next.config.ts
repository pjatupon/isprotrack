import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["10.153.53.243"],
  typedRoutes: false,
  experimental: {
    serverActions: {
      bodySizeLimit: "16mb",
    },
  },
  serverExternalPackages: ["sharp", "mupdf"],
};

export default nextConfig;
