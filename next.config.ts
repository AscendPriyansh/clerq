import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdf-parse", "tesseract.js", "@napi-rs/canvas"],
  experimental: { serverActions: { bodySizeLimit: "6mb" } },
};

export default nextConfig;
