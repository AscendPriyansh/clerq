import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdf-parse", "tesseract.js", "@napi-rs/canvas"],
  outputFileTracingIncludes: {
    "/api/queues/jobs": ["./node_modules/tesseract.js/src/worker-script/**", "./node_modules/tesseract.js-core/**", "./node_modules/pdf-parse/dist/**", "./node_modules/@napi-rs/canvas/**", "./node_modules/@napi-rs/canvas-*/**"],
  },
  experimental: { serverActions: { bodySizeLimit: "6mb" } },
};

export default nextConfig;
