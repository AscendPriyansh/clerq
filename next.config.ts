import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdf-parse", "tesseract.js", "@napi-rs/canvas"],
  outputFileTracingIncludes: {
    "/api/queues/jobs": [
      "./lib/ai/ocr-worker.cjs",
      "./node_modules/tesseract.js/package.json", "./node_modules/tesseract.js/src/**",
      "./node_modules/tesseract.js-core/**", "./node_modules/wasm-feature-detect/**",
      "./node_modules/bmp-js/**", "./node_modules/is-url/**", "./node_modules/regenerator-runtime/**",
      "./node_modules/@tesseract.js-data/eng/package.json",
      "./node_modules/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz",
      "./node_modules/pdf-parse/dist/**", "./node_modules/@napi-rs/canvas/**", "./node_modules/@napi-rs/canvas-*/**",
    ],
  },
  experimental: { serverActions: { bodySizeLimit: "6mb" } },
};

export default nextConfig;
